pub mod engine;
pub mod hnsw;
pub mod memtable;
pub mod quantization;
pub mod segment;
pub mod types;
pub mod wal;

pub mod proto {
    tonic::include_proto!("storage");
}

pub use engine::{EngineConfig, EngineStats, VectorStorageEngine};
pub use hnsw::{HnswConfig, HnswIndex};
pub use memtable::{ActiveMemTable, ImmutableMemTable};
pub use quantization::QuantizedVector;
pub use segment::{DiskSegment, Manifest, SegmentMeta};
pub use types::{dot_product, Neighbor, VectorId, VectorItem, DEFAULT_DIMENSION};
pub use wal::{WalReader, WalRecord, WalWriter};
