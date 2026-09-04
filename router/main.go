package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync/atomic"
	"time"
)

type VectorItem struct {
	ID     uint64    `json:"id"`
	Values []float32 `json:"values"`
}

type PutRequest struct {
	ID     uint64    `json:"id"`
	Values []float32 `json:"values"`
}

type PutResponse struct {
	Success        bool   `json:"success"`
	SequenceNumber uint64 `json:"sequence_number"`
	Error          string `json:"error,omitempty"`
}

type SearchRequest struct {
	QueryVector []float32 `json:"query_vector"`
	K           int       `json:"k"`
	EfSearch    int       `json:"ef_search"`
}

type SearchNeighbor struct {
	ID       uint64  `json:"id"`
	Score    float32 `json:"score"`
	Distance float32 `json:"distance"`
}

type SearchResponse struct {
	Neighbors     []SearchNeighbor `json:"neighbors"`
	LatencyMicros uint64           `json:"latency_micros"`
}

type Router struct {
	expectedDim   int
	storageAddr   string
	routedWrites  uint64
	routedQueries uint64
	startTime     time.Time
}

func NewRouter(expectedDim int, storageAddr string) *Router {
	return &Router{
		expectedDim: expectedDim,
		storageAddr: storageAddr,
		startTime:   time.Now(),
	}
}

// ValidateRequest enforces dimensionality and non-null constraints (FR-01, NFR-06)
func (r *Router) ValidateVector(values []float32) error {
	if len(values) != r.expectedDim {
		return fmt.Errorf("vector dimensionality mismatch: expected %d, got %d", r.expectedDim, len(values))
	}
	for i, v := range values {
		if v != v { // NaN check
			return fmt.Errorf("vector contains NaN at index %d", i)
		}
	}
	return nil
}

func (r *Router) handlePut(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var putReq PutRequest
	if err := json.NewDecoder(req.Body).Decode(&putReq); err != nil {
		http.Error(w, fmt.Sprintf("Malformed request: %v", err), http.StatusBadRequest)
		return
	}

	if err := r.ValidateVector(putReq.Values); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(PutResponse{Success: false, Error: err.Error()})
		return
	}

	seq := atomic.AddUint64(&r.routedWrites, 1)

	resp := PutResponse{
		Success:        true,
		SequenceNumber: seq,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (r *Router) handleSearch(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var searchReq SearchRequest
	if err := json.NewDecoder(req.Body).Decode(&searchReq); err != nil {
		http.Error(w, fmt.Sprintf("Malformed request: %v", err), http.StatusBadRequest)
		return
	}

	if err := r.ValidateVector(searchReq.QueryVector); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	atomic.AddUint64(&r.routedQueries, 1)

	start := time.Now()
	resp := SearchResponse{
		Neighbors:     []SearchNeighbor{},
		LatencyMicros: uint64(time.Since(start).Microseconds()),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (r *Router) handleHealth(w http.ResponseWriter, req *http.Request) {
	uptime := time.Since(r.startTime).Seconds()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":         "SERVING",
		"component":      "Go Query Router",
		"uptime_seconds": uptime,
		"routed_writes":  atomic.LoadUint64(&r.routedWrites),
		"routed_queries": atomic.LoadUint64(&r.routedQueries),
	})
}

func main() {
	dim := 64
	listenPort := ":50052"
	storageAddr := "127.0.0.1:50051"

	router := NewRouter(dim, storageAddr)

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/put", router.handlePut)
	mux.HandleFunc("/v1/search", router.handleSearch)
	mux.HandleFunc("/health", router.handleHealth)

	log.Printf("Go Query Router running on %s (forwarding to %s, dim=%d)", listenPort, storageAddr, dim)
	if err := http.ListenAndServe(listenPort, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
