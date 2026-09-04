use crate::hnsw::{HnswConfig, HnswIndex};
use crate::memtable::ImmutableMemTable;
use crate::quantization::QuantizedVector;
use crate::types::{Neighbor, VectorId};
use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use crc32fast::Hasher;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub const SEGMENT_MAGIC: &[u8; 4] = b"VSEG";
pub const SEGMENT_VERSION: u16 = 1;
pub const SEGMENT_FOOTER_MAGIC: &[u8; 4] = b"SEGF";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentMeta {
    pub segment_id: u64,
    pub vector_count: usize,
    pub dimension: usize,
    pub min_seq_no: u64,
    pub max_seq_no: u64,
    pub file_path: String,
    pub crc32: u32,
    pub created_at_unix: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Manifest {
    pub version: u32,
    pub last_segment_id: u64,
    pub max_durable_seq_no: u64,
    pub segments: Vec<SegmentMeta>,
}

impl Manifest {
    pub fn load<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let path = path.as_ref();
        if !path.exists() {
            return Ok(Self::default());
        }
        let data = fs::read_to_string(path)?;
        let manifest: Manifest = serde_json::from_str(&data)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        Ok(manifest)
    }

    /// Atomically saves manifest by writing to temporary file and renaming
    pub fn atomic_save<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        let path = path.as_ref();
        let tmp_path = path.with_extension("tmp");
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        {
            let mut file = BufWriter::new(File::create(&tmp_path)?);
            file.write_all(json.as_bytes())?;
            file.flush()?;
            file.get_ref().sync_all()?;
        }

        fs::rename(&tmp_path, path)?;
        Ok(())
    }
}

pub struct DiskSegment {
    pub meta: SegmentMeta,
    pub ids: Vec<VectorId>,
    pub quantized_vectors: Vec<QuantizedVector>,
    pub hnsw: HnswIndex,
}

impl DiskSegment {
    /// Builds a persistent immutable segment from an ImmutableMemTable.
    /// Invariant INV-04: The segment is written to a .tmp file and only published upon complete validation.
    pub fn build_and_publish<P: AsRef<Path>>(
        memtable: &ImmutableMemTable,
        dir: P,
        segment_id: u64,
        hnsw_config: HnswConfig,
    ) -> io::Result<Arc<Self>> {
        let dir = dir.as_ref();
        fs::create_dir_all(dir)?;

        let final_filename = format!("segment_{:06}.db", segment_id);
        let tmp_filename = format!("segment_{:06}.tmp", segment_id);
        let final_path = dir.join(&final_filename);
        let tmp_path = dir.join(&tmp_filename);

        let count = memtable.len();
        let dim = memtable.dimension;

        // 1. Quantize all vectors
        let mut quantized = Vec::with_capacity(count);
        for i in 0..count {
            let v = memtable.get_vector(i).unwrap();
            quantized.push(QuantizedVector::quantize(v));
        }

        // 2. Build HNSW index on the quantized vectors
        let hnsw = HnswIndex::build(&quantized, hnsw_config);

        // 3. Serialize to tmp file and compute CRC32
        let mut hasher = Hasher::new();
        {
            let file = File::create(&tmp_path)?;
            let mut writer = BufWriter::with_capacity(256 * 1024, file);

            // Magic & version
            writer.write_all(SEGMENT_MAGIC)?;
            writer.write_u16::<LittleEndian>(SEGMENT_VERSION)?;

            // Header metadata
            let mut header_buf = Vec::new();
            header_buf.write_u64::<LittleEndian>(segment_id)?;
            header_buf.write_u32::<LittleEndian>(count as u32)?;
            header_buf.write_u32::<LittleEndian>(dim as u32)?;
            header_buf.write_u64::<LittleEndian>(memtable.min_seq)?;
            header_buf.write_u64::<LittleEndian>(memtable.max_seq)?;
            hasher.update(&header_buf);
            writer.write_all(&header_buf)?;

            // Vector IDs
            for &id in memtable.ids.iter() {
                let bytes = id.to_le_bytes();
                hasher.update(&bytes);
                writer.write_all(&bytes)?;
            }

            // Quantized vectors
            for qv in &quantized {
                let min_bytes = qv.min_val.to_le_bytes();
                let scale_bytes = qv.scale.to_le_bytes();
                hasher.update(&min_bytes);
                hasher.update(&scale_bytes);
                hasher.update(&qv.data);
                writer.write_all(&min_bytes)?;
                writer.write_all(&scale_bytes)?;
                writer.write_all(&qv.data)?;
            }

            // HNSW serialized json
            let hnsw_json = serde_json::to_vec(&hnsw)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            let hnsw_len = hnsw_json.len() as u32;
            let len_bytes = hnsw_len.to_le_bytes();
            hasher.update(&len_bytes);
            hasher.update(&hnsw_json);
            writer.write_all(&len_bytes)?;
            writer.write_all(&hnsw_json)?;

            // CRC32 Checksum
            let crc = hasher.finalize();
            writer.write_u32::<LittleEndian>(crc)?;
            writer.write_all(SEGMENT_FOOTER_MAGIC)?;

            writer.flush()?;
            writer.get_ref().sync_all()?;
        }

        // 4. Atomic publication: rename tmp -> final
        fs::rename(&tmp_path, &final_path)?;

        let meta = SegmentMeta {
            segment_id,
            vector_count: count,
            dimension: dim,
            min_seq_no: memtable.min_seq,
            max_seq_no: memtable.max_seq,
            file_path: final_path.to_string_lossy().to_string(),
            crc32: 0,
            created_at_unix: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let segment = Self {
            meta,
            ids: (*memtable.ids).clone(),
            quantized_vectors: quantized,
            hnsw,
        };

        Ok(Arc::new(segment))
    }

    /// Loads and validates an immutable segment from disk.
    /// Verifies CRC32 and magic headers.
    pub fn load<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let path = path.as_ref();
        let file = File::open(path)?;
        let mut reader = BufReader::new(file);

        let mut magic = [0u8; 4];
        reader.read_exact(&mut magic)?;
        if &magic != SEGMENT_MAGIC {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "Invalid segment magic"));
        }

        let version = reader.read_u16::<LittleEndian>()?;
        if version != SEGMENT_VERSION {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "Unsupported segment version"));
        }

        let mut hasher = Hasher::new();

        let segment_id = reader.read_u64::<LittleEndian>()?;
        let count = reader.read_u32::<LittleEndian>()? as usize;
        let dim = reader.read_u32::<LittleEndian>()? as usize;
        let min_seq_no = reader.read_u64::<LittleEndian>()?;
        let max_seq_no = reader.read_u64::<LittleEndian>()?;

        hasher.update(&segment_id.to_le_bytes());
        hasher.update(&(count as u32).to_le_bytes());
        hasher.update(&(dim as u32).to_le_bytes());
        hasher.update(&min_seq_no.to_le_bytes());
        hasher.update(&max_seq_no.to_le_bytes());

        // Read IDs
        let mut ids = Vec::with_capacity(count);
        for _ in 0..count {
            let id = reader.read_u64::<LittleEndian>()?;
            hasher.update(&id.to_le_bytes());
            ids.push(id);
        }

        // Read Quantized Vectors
        let mut quantized_vectors = Vec::with_capacity(count);
        for _ in 0..count {
            let min_val = reader.read_f32::<LittleEndian>()?;
            let scale = reader.read_f32::<LittleEndian>()?;
            let mut data = vec![0u8; dim];
            reader.read_exact(&mut data)?;

            hasher.update(&min_val.to_le_bytes());
            hasher.update(&scale.to_le_bytes());
            hasher.update(&data);

            quantized_vectors.push(QuantizedVector {
                min_val,
                scale,
                data,
            });
        }

        // Read HNSW JSON
        let hnsw_len = reader.read_u32::<LittleEndian>()? as usize;
        hasher.update(&(hnsw_len as u32).to_le_bytes());
        let mut hnsw_buf = vec![0u8; hnsw_len];
        reader.read_exact(&mut hnsw_buf)?;
        hasher.update(&hnsw_buf);

        let hnsw: HnswIndex = serde_json::from_slice(&hnsw_buf)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        // Read and verify CRC
        let expected_crc = reader.read_u32::<LittleEndian>()?;
        let computed_crc = hasher.finalize();
        if expected_crc != computed_crc {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("Segment CRC mismatch: expected {:x}, got {:x}", expected_crc, computed_crc),
            ));
        }

        let mut footer = [0u8; 4];
        reader.read_exact(&mut footer)?;
        if &footer != SEGMENT_FOOTER_MAGIC {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "Invalid segment footer"));
        }

        let meta = SegmentMeta {
            segment_id,
            vector_count: count,
            dimension: dim,
            min_seq_no,
            max_seq_no,
            file_path: path.to_string_lossy().to_string(),
            crc32: computed_crc,
            created_at_unix: 0,
        };

        Ok(Self {
            meta,
            ids,
            quantized_vectors,
            hnsw,
        })
    }

    /// Search the segment using HNSW graph traversal
    pub fn search(&self, query: &[f32], k: usize, ef_search: usize) -> Vec<Neighbor> {
        self.hnsw.search(query, k, ef_search, &self.quantized_vectors, &self.ids)
    }
}
