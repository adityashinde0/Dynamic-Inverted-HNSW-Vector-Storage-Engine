use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantizedVector {
    pub min_val: f32,
    pub scale: f32, // (max_val - min_val) / 255.0
    pub data: Vec<u8>,
}

impl QuantizedVector {
    pub fn quantize(v: &[f32]) -> Self {
        let mut min_val = f32::INFINITY;
        let mut max_val = f32::NEG_INFINITY;

        for &val in v {
            if val < min_val {
                min_val = val;
            }
            if val > max_val {
                max_val = val;
            }
        }

        let range = (max_val - min_val).max(1e-8);
        let scale = range / 255.0;
        let inv_scale = 255.0 / range;

        let mut data = Vec::with_capacity(v.len());
        for &val in v {
            let q = ((val - min_val) * inv_scale).round().clamp(0.0, 255.0) as u8;
            data.push(q);
        }

        Self {
            min_val,
            scale,
            data,
        }
    }

    #[inline(always)]
    pub fn dequantize(&self, output: &mut [f32]) {
        for (i, &q) in self.data.iter().enumerate() {
            output[i] = self.min_val + (q as f32) * self.scale;
        }
    }

    /// Fast Asymmetric Inner Product between float32 query and quantized vector:
    /// query_sum is precomputed as sum(query[i])
    #[inline(always)]
    pub fn asymmetric_dot_product(&self, query: &[f32], query_sum: f32) -> f32 {
        let mut int_sum = 0.0f32;
        let chunks_q = query.chunks_exact(8);
        let chunks_d = self.data.chunks_exact(8);
        let rem_q = chunks_q.remainder();
        let rem_d = chunks_d.remainder();

        for (cq, cd) in chunks_q.zip(chunks_d) {
            int_sum += cq[0] * (cd[0] as f32)
                + cq[1] * (cd[1] as f32)
                + cq[2] * (cd[2] as f32)
                + cq[3] * (cd[3] as f32)
                + cq[4] * (cd[4] as f32)
                + cq[5] * (cd[5] as f32)
                + cq[6] * (cd[6] as f32)
                + cq[7] * (cd[7] as f32);
        }

        for (&vq, &vd) in rem_q.iter().zip(rem_d.iter()) {
            int_sum += vq * (vd as f32);
        }

        self.min_val * query_sum + self.scale * int_sum
    }
}
