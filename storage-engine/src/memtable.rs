use crate::types::{dot_product, Neighbor, VectorId, VectorItem, DEFAULT_DIMENSION};
use parking_lot::RwLock;
use std::cmp::Reverse;
use std::collections::BinaryHeap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

pub struct ActiveMemTable {
    inner: RwLock<MemTableData>,
    vector_count: AtomicUsize,
    dimension: usize,
}

struct MemTableData {
    ids: Vec<VectorId>,
    vectors: Vec<f32>, // Contiguous buffer: len = ids.len() * dimension
}

impl ActiveMemTable {
    pub fn new(dimension: usize) -> Self {
        Self {
            inner: RwLock::new(MemTableData {
                ids: Vec::with_capacity(16384),
                vectors: Vec::with_capacity(16384 * dimension),
            }),
            vector_count: AtomicUsize::new(0),
            dimension,
        }
    }

    pub fn insert(&self, id: VectorId, values: &[f32]) -> Result<(), String> {
        if values.len() != self.dimension {
            return Err(format!(
                "Vector dimension mismatch: expected {}, got {}",
                self.dimension,
                values.len()
            ));
        }

        let mut data = self.inner.write();
        data.ids.push(id);
        data.vectors.extend_from_slice(values);
        self.vector_count.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }

    pub fn insert_batch(&self, items: &[VectorItem]) -> Result<(), String> {
        let mut data = self.inner.write();
        for item in items {
            if item.values.len() != self.dimension {
                return Err(format!(
                    "Vector dimension mismatch for id {}: expected {}, got {}",
                    item.id,
                    self.dimension,
                    item.values.len()
                ));
            }
            data.ids.push(item.id);
            data.vectors.extend_from_slice(&item.values);
        }
        self.vector_count.fetch_add(items.len(), Ordering::Relaxed);
        Ok(())
    }

    pub fn search(&self, query: &[f32], k: usize) -> Vec<Neighbor> {
        let data = self.inner.read();
        search_flat_vectors(&data.ids, &data.vectors, self.dimension, query, k)
    }

    pub fn len(&self) -> usize {
        self.vector_count.load(Ordering::Relaxed)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn size_bytes(&self) -> usize {
        let data = self.inner.read();
        data.ids.len() * std::mem::size_of::<VectorId>()
            + data.vectors.len() * std::mem::size_of::<f32>()
    }

    /// Freezes the active MemTable into an ImmutableMemTable.
    pub fn freeze(&self, id: u64, min_seq: u64, max_seq: u64) -> ImmutableMemTable {
        let mut data = self.inner.write();
        let ids = std::mem::take(&mut data.ids);
        let vectors = std::mem::take(&mut data.vectors);
        self.vector_count.store(0, Ordering::Relaxed);

        ImmutableMemTable {
            id,
            min_seq,
            max_seq,
            dimension: self.dimension,
            ids: Arc::new(ids),
            vectors: Arc::new(vectors),
        }
    }
}

/// An immutable, sealed in-memory MemTable awaiting or undergoing background segment flush.
/// Strictly read-only to guarantee Invariant INV-02.
#[derive(Clone)]
pub struct ImmutableMemTable {
    pub id: u64,
    pub min_seq: u64,
    pub max_seq: u64,
    pub dimension: usize,
    pub ids: Arc<Vec<VectorId>>,
    pub vectors: Arc<Vec<f32>>,
}

impl ImmutableMemTable {
    pub fn len(&self) -> usize {
        self.ids.len()
    }

    pub fn is_empty(&self) -> bool {
        self.ids.is_empty()
    }

    pub fn get_vector(&self, index: usize) -> Option<&[f32]> {
        if index >= self.ids.len() {
            None
        } else {
            let start = index * self.dimension;
            let end = start + self.dimension;
            Some(&self.vectors[start..end])
        }
    }

    pub fn search(&self, query: &[f32], k: usize) -> Vec<Neighbor> {
        search_flat_vectors(&self.ids, &self.vectors, self.dimension, query, k)
    }
}

/// Internal helper for exact top-k nearest neighbor search over flat float32 vectors.
fn search_flat_vectors(
    ids: &[VectorId],
    vectors: &[f32],
    dim: usize,
    query: &[f32],
    k: usize,
) -> Vec<Neighbor> {
    if ids.is_empty() || k == 0 || query.len() != dim {
        return Vec::new();
    }

    // Min-heap storing worst candidate at the top so we can pop when full
    let mut heap: BinaryHeap<Neighbor> = BinaryHeap::with_capacity(k + 1);

    for (i, &id) in ids.iter().enumerate() {
        let offset = i * dim;
        let v = &vectors[offset..offset + dim];
        let score = dot_product(query, v);
        let distance = 1.0 - score;

        let neighbor = Neighbor { id, score, distance };

        if heap.len() < k {
            heap.push(neighbor);
        } else if let Some(worst) = heap.peek() {
            if neighbor.distance < worst.distance {
                heap.pop();
                heap.push(neighbor);
            }
        }
    }

    // Drain and sort ascending by distance (best first)
    let mut results: Vec<Neighbor> = heap.into_vec();
    results.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap_or(std::cmp::Ordering::Equal));
    results
}
