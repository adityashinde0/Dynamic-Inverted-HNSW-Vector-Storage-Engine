export interface EngineStats {
  total_writes: number;
  active_memtable_vectors: number;
  immutable_memtable_vectors: number;
  segment_count: number;
  total_segment_vectors: number;
  wal_size_bytes: number;
  total_queries: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  write_qps: number;
  query_qps: number;
  recovering: boolean;
  memtable_threshold?: number;
  memtable_fill_pct?: number;
}

export interface LatencyHistoryPoint {
  p50: number;
  p95: number;
  p99: number;
  timestamp: number;
}

export interface ThroughputHistoryPoint {
  writeQps: number;
  queryQps: number;
  timestamp: number;
}
