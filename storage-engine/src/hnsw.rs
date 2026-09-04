use crate::quantization::QuantizedVector;
use crate::types::{dot_product, Neighbor, VectorId};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HnswConfig {
    pub m: usize,              // Max number of edges per node per upper layer
    pub m0: usize,             // Max number of edges per node at layer 0
    pub ef_construction: usize,// Size of dynamic candidate list during construction
    pub ef_search: usize,      // Size of dynamic candidate list during search
    pub ml: f64,               // Normalization factor for level generation (1.0 / ln(M))
}

impl Default for HnswConfig {
    fn default() -> Self {
        let m = 16;
        Self {
            m,
            m0: 32,
            ef_construction: 64,
            ef_search: 32,
            ml: 1.0 / (m as f64).ln(),
        }
    }
}

#[derive(Copy, Clone, PartialEq)]
struct Candidate {
    node_id: usize,
    distance: f32,
}

impl Eq for Candidate {}

impl PartialOrd for Candidate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Reverse ordering for min-heap (lowest distance at top)
        other.distance.partial_cmp(&self.distance)
    }
}

impl Ord for Candidate {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HnswIndex {
    pub config: HnswConfig,
    pub entry_point: Option<usize>,
    pub max_layer: usize,
    // adjacency[node_id][layer] = list of neighbor node_ids
    pub adjacency: Vec<Vec<Vec<u32>>>,
}

impl HnswIndex {
    pub fn new(config: HnswConfig) -> Self {
        Self {
            config,
            entry_point: None,
            max_layer: 0,
            adjacency: Vec::new(),
        }
    }

    /// Builds HNSW index from a collection of quantized vectors
    pub fn build(quantized_vectors: &[QuantizedVector], config: HnswConfig) -> Self {
        let mut index = Self::new(config);
        let n = quantized_vectors.len();
        if n == 0 {
            return index;
        }

        index.adjacency.resize_with(n, Vec::new);
        let mut rng = rand::thread_rng();

        for i in 0..n {
            index.insert_node(i, quantized_vectors, &mut rng);
        }

        index
    }

    fn random_level(&self, rng: &mut impl Rng) -> usize {
        let unif: f64 = rng.gen_range(1e-7..1.0);
        (-unif.ln() * self.config.ml).floor() as usize
    }

    fn insert_node(
        &mut self,
        node_id: usize,
        vectors: &[QuantizedVector],
        rng: &mut impl Rng,
    ) {
        let target_level = self.random_level(rng);
        self.adjacency[node_id].resize_with(target_level + 1, Vec::new);

        let ep = match self.entry_point {
            None => {
                self.entry_point = Some(node_id);
                self.max_layer = target_level;
                return;
            }
            Some(ep) => ep,
        };

        let mut curr_ep = ep;
        let max_l = self.max_layer;

        // Phase 1: greedy search from top layer down to target_level + 1
        for l in (target_level + 1..=max_l).rev() {
            curr_ep = self.search_layer_greedy(curr_ep, node_id, l, vectors);
        }

        // Phase 2: from min(target_level, max_l) down to 0, find ef_construction nearest neighbors
        let mut ep_candidates = vec![curr_ep];
        for l in (0..=target_level.min(max_l)).rev() {
            let m_max = if l == 0 { self.config.m0 } else { self.config.m };
            let candidates = self.search_layer_ef(
                &ep_candidates,
                node_id,
                l,
                self.config.ef_construction,
                vectors,
            );

            // Select neighbors
            let selected_neighbors: Vec<u32> = candidates
                .iter()
                .take(m_max)
                .map(|c| c.node_id as u32)
                .collect();

            self.adjacency[node_id][l] = selected_neighbors.clone();

            // Add back-links
            for &nbr_u32 in &selected_neighbors {
                let nbr = nbr_u32 as usize;
                if l < self.adjacency[nbr].len() {
                    self.adjacency[nbr][l].push(node_id as u32);
                    if self.adjacency[nbr][l].len() > m_max {
                        self.shrink_edges(nbr, l, m_max, vectors);
                    }
                }
            }

            ep_candidates = candidates.iter().map(|c| c.node_id).collect();
        }

        if target_level > self.max_layer {
            self.max_layer = target_level;
            self.entry_point = Some(node_id);
        }
    }

    fn search_layer_greedy(
        &self,
        ep: usize,
        target_id: usize,
        layer: usize,
        vectors: &[QuantizedVector],
    ) -> usize {
        let mut curr = ep;
        let mut curr_dist = dist_quantized(&vectors[curr], &vectors[target_id]);

        loop {
            let mut changed = false;
            if layer < self.adjacency[curr].len() {
                for &nbr_u32 in &self.adjacency[curr][layer] {
                    let nbr = nbr_u32 as usize;
                    let d = dist_quantized(&vectors[nbr], &vectors[target_id]);
                    if d < curr_dist {
                        curr_dist = d;
                        curr = nbr;
                        changed = true;
                    }
                }
            }
            if !changed {
                break;
            }
        }
        curr
    }

    fn search_layer_ef(
        &self,
        entry_points: &[usize],
        target_id: usize,
        layer: usize,
        ef: usize,
        vectors: &[QuantizedVector],
    ) -> Vec<Candidate> {
        let mut visited = HashSet::new();
        let mut candidates_pq = BinaryHeap::new(); // Min-heap (closest popped first)
        let mut result_pq: BinaryHeap<NeighborCandidate> = BinaryHeap::new(); // Max-heap (furthest popped first)

        for &ep in entry_points {
            if visited.insert(ep) {
                let d = dist_quantized(&vectors[ep], &vectors[target_id]);
                candidates_pq.push(Candidate { node_id: ep, distance: d });
                result_pq.push(NeighborCandidate { node_id: ep, distance: d });
            }
        }

        while let Some(curr) = candidates_pq.pop() {
            let furthest_dist = result_pq.peek().map(|c| c.distance).unwrap_or(f32::INFINITY);
            if curr.distance > furthest_dist && result_pq.len() >= ef {
                break;
            }

            if layer < self.adjacency[curr.node_id].len() {
                for &nbr_u32 in &self.adjacency[curr.node_id][layer] {
                    let nbr = nbr_u32 as usize;
                    if visited.insert(nbr) {
                        let d = dist_quantized(&vectors[nbr], &vectors[target_id]);
                        let furthest = result_pq.peek().map(|c| c.distance).unwrap_or(f32::INFINITY);
                        if d < furthest || result_pq.len() < ef {
                            candidates_pq.push(Candidate { node_id: nbr, distance: d });
                            result_pq.push(NeighborCandidate { node_id: nbr, distance: d });
                            if result_pq.len() > ef {
                                result_pq.pop();
                            }
                        }
                    }
                }
            }
        }

        let mut res = Vec::with_capacity(result_pq.len());
        while let Some(c) = result_pq.pop() {
            res.push(Candidate { node_id: c.node_id, distance: c.distance });
        }
        res.reverse(); // Now closest first
        res
    }

    fn shrink_edges(&mut self, node_id: usize, layer: usize, max_edges: usize, vectors: &[QuantizedVector]) {
        let edges = &self.adjacency[node_id][layer];
        let mut candidates: Vec<(u32, f32)> = edges
            .iter()
            .map(|&nbr_u32| {
                let d = dist_quantized(&vectors[node_id], &vectors[nbr_u32 as usize]);
                (nbr_u32, d)
            })
            .collect();

        candidates.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(Ordering::Equal));
        candidates.truncate(max_edges);

        self.adjacency[node_id][layer] = candidates.into_iter().map(|(n, _)| n).collect();
    }

    /// Search for k nearest neighbors using a raw float32 query vector
    pub fn search(
        &self,
        query: &[f32],
        k: usize,
        ef_search: usize,
        quantized_vectors: &[QuantizedVector],
        vector_ids: &[VectorId],
    ) -> Vec<Neighbor> {
        let ep = match self.entry_point {
            Some(ep) => ep,
            None => return Vec::new(),
        };

        let query_sum: f32 = query.iter().sum();
        let dist_fn = |node_idx: usize| -> f32 {
            let score = quantized_vectors[node_idx].asymmetric_dot_product(query, query_sum);
            1.0 - score
        };

        let mut curr_ep = ep;
        let mut curr_dist = dist_fn(curr_ep);

        // Greedy search on upper layers
        for l in (1..=self.max_layer).rev() {
            loop {
                let mut changed = false;
                if l < self.adjacency[curr_ep].len() {
                    for &nbr_u32 in &self.adjacency[curr_ep][l] {
                        let nbr = nbr_u32 as usize;
                        let d = dist_fn(nbr);
                        if d < curr_dist {
                            curr_dist = d;
                            curr_ep = nbr;
                            changed = true;
                        }
                    }
                }
                if !changed {
                    break;
                }
            }
        }

        // Beam search at layer 0
        let ef = ef_search.max(k);
        let mut visited = HashSet::new();
        let mut candidates_pq = BinaryHeap::new();
        let mut result_pq: BinaryHeap<NeighborCandidate> = BinaryHeap::new();

        visited.insert(curr_ep);
        candidates_pq.push(Candidate { node_id: curr_ep, distance: curr_dist });
        result_pq.push(NeighborCandidate { node_id: curr_ep, distance: curr_dist });

        while let Some(curr) = candidates_pq.pop() {
            let furthest_dist = result_pq.peek().map(|c| c.distance).unwrap_or(f32::INFINITY);
            if curr.distance > furthest_dist && result_pq.len() >= ef {
                break;
            }

            if let Some(neighbors) = self.adjacency[curr.node_id].get(0) {
                for &nbr_u32 in neighbors {
                    let nbr = nbr_u32 as usize;
                    if visited.insert(nbr) {
                        let d = dist_fn(nbr);
                        let furthest = result_pq.peek().map(|c| c.distance).unwrap_or(f32::INFINITY);
                        if d < furthest || result_pq.len() < ef {
                            candidates_pq.push(Candidate { node_id: nbr, distance: d });
                            result_pq.push(NeighborCandidate { node_id: nbr, distance: d });
                            if result_pq.len() > ef {
                                result_pq.pop();
                            }
                        }
                    }
                }
            }
        }

        let mut res = Vec::with_capacity(result_pq.len());
        while let Some(c) = result_pq.pop() {
            res.push(Neighbor {
                id: vector_ids[c.node_id],
                score: 1.0 - c.distance,
                distance: c.distance,
            });
        }
        res.reverse();
        res.truncate(k);
        res
    }
}

#[derive(Copy, Clone, PartialEq)]
struct NeighborCandidate {
    node_id: usize,
    distance: f32,
}

impl Eq for NeighborCandidate {}

impl PartialOrd for NeighborCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Max-heap ordering (highest distance at top)
        self.distance.partial_cmp(&other.distance)
    }
}

impl Ord for NeighborCandidate {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

#[inline(always)]
fn dist_quantized(a: &QuantizedVector, b: &QuantizedVector) -> f32 {
    let mut int_sum = 0.0f32;
    let chunks_a = a.data.chunks_exact(8);
    let chunks_b = b.data.chunks_exact(8);

    for (ca, cb) in chunks_a.zip(chunks_b) {
        int_sum += (ca[0] as f32) * (cb[0] as f32)
            + (ca[1] as f32) * (cb[1] as f32)
            + (ca[2] as f32) * (cb[2] as f32)
            + (ca[3] as f32) * (cb[3] as f32)
            + (ca[4] as f32) * (cb[4] as f32)
            + (ca[5] as f32) * (cb[5] as f32)
            + (ca[6] as f32) * (cb[6] as f32)
            + (ca[7] as f32) * (cb[7] as f32);
    }

    let dot = a.min_val * b.min_val * (a.data.len() as f32)
        + a.scale * b.scale * int_sum;
    1.0 - dot
}
