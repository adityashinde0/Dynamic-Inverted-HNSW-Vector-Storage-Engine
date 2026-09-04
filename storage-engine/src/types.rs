use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

pub type VectorId = u64;
pub const DEFAULT_DIMENSION: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorItem {
    pub id: VectorId,
    pub values: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Neighbor {
    pub id: VectorId,
    pub score: f32,     // Cosine similarity: -1.0 to 1.0 (higher = closer)
    pub distance: f32,  // 1.0 - score (lower = closer)
}

impl Eq for Neighbor {}

impl PartialOrd for Neighbor {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Compare by distance ascending (closer first)
        self.distance.partial_cmp(&other.distance)
    }
}

impl Ord for Neighbor {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

/// Computes inner product (dot product) of two float vectors.
/// For unit-normalized vectors, this equals cosine similarity.
#[inline(always)]
pub fn dot_product(a: &[f32], b: &[f32]) -> f32 {
    let mut sum = 0.0f32;
    let chunks_a = a.chunks_exact(8);
    let chunks_b = b.chunks_exact(8);
    let rem_a = chunks_a.remainder();
    let rem_b = chunks_b.remainder();

    for (ca, cb) in chunks_a.zip(chunks_b) {
        sum += ca[0] * cb[0]
            + ca[1] * cb[1]
            + ca[2] * cb[2]
            + ca[3] * cb[3]
            + ca[4] * cb[4]
            + ca[5] * cb[5]
            + ca[6] * cb[6]
            + ca[7] * cb[7];
    }
    for (va, vb) in rem_a.iter().zip(rem_b.iter()) {
        sum += va * vb;
    }
    sum
}

/// Normalizes a vector in-place.
pub fn normalize(v: &mut [f32]) {
    let norm = dot_product(v, v).sqrt();
    if norm > 1e-8 {
        let inv = 1.0 / norm;
        for val in v.iter_mut() {
            *val *= inv;
        }
    }
}
