use crate::hnsw::HnswConfig;
use crate::memtable::{ActiveMemTable, ImmutableMemTable};
use crate::segment::{DiskSegment, Manifest};
use crate::types::{Neighbor, VectorId, VectorItem, DEFAULT_DIMENSION};
use crate::wal::{WalReader, WalWriter};
use crossbeam_channel::{unbounded, Sender};
use parking_lot::{Mutex, RwLock};
use rayon::prelude::*;
use std::collections::{BinaryHeap, HashSet, VecDeque};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub base_dir: PathBuf,
    pub dimension: usize,
    pub memtable_threshold_count: usize,
    pub hnsw_config: HnswConfig,
    pub ef_search: usize,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            base_dir: PathBuf::from("data"),
            dimension: DEFAULT_DIMENSION,
            memtable_threshold_count: 5000,
            hnsw_config: HnswConfig::default(),
            ef_search: 32,
        }
    }
}

pub struct EngineStats {
    pub total_writes: u64,
    pub active_memtable_vectors: usize,
    pub immutable_memtable_vectors: usize,
    pub segment_count: usize,
    pub total_segment_vectors: usize,
    pub wal_size_bytes: u64,
    pub total_queries: u64,
    pub p50_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
    pub write_qps: f64,
    pub query_qps: f64,
    pub recovering: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SearchFanoutTarget {
    pub target_name: String,
    pub target_type: String,
    pub vector_count: usize,
    pub candidates_found: usize,
    pub latency_us: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DetailedNeighbor {
    pub id: VectorId,
    pub score: f32,
    pub distance: f32,
    pub source: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DetailedSearchResult {
    pub results: Vec<DetailedNeighbor>,
    pub fanout: Vec<SearchFanoutTarget>,
    pub total_latency_us: u64,
}

pub struct VectorStorageEngine {
    config: EngineConfig,
    wal: Mutex<WalWriter>,
    active_memtable: Arc<ActiveMemTable>,
    immutable_queue: Arc<RwLock<VecDeque<ImmutableMemTable>>>,
    segments: Arc<RwLock<Vec<Arc<DiskSegment>>>>,
    manifest: Mutex<Manifest>,
    flush_tx: Sender<()>,
    bg_worker: Option<JoinHandle<()>>,
    shutdown: Arc<AtomicBool>,
    total_writes: AtomicU64,
    total_queries: AtomicU64,
    current_min_seq: AtomicU64,
    query_latencies_us: Mutex<Vec<u64>>,
    last_stat_time: Mutex<Instant>,
    last_write_count: AtomicU64,
    last_query_count: AtomicU64,
    write_rate: Mutex<f64>,
    query_rate: Mutex<f64>,
}

impl VectorStorageEngine {
    pub fn open(config: EngineConfig) -> io::Result<Arc<Self>> {
        fs::create_dir_all(&config.base_dir)?;
        let segments_dir = config.base_dir.join("segments");
        fs::create_dir_all(&segments_dir)?;
        let wal_path = config.base_dir.join("wal.log");
        let manifest_path = config.base_dir.join("manifest.json");

        // 1. Load manifest
        let manifest = Manifest::load(&manifest_path)?;

        // 2. Discover and load durable segments
        let mut loaded_segments = Vec::new();
        let mut max_durable_seq = manifest.max_durable_seq_no;
        for meta in &manifest.segments {
            let seg_path = PathBuf::from(&meta.file_path);
            if seg_path.exists() {
                match DiskSegment::load(&seg_path) {
                    Ok(seg) => {
                        if seg.meta.max_seq_no > max_durable_seq {
                            max_durable_seq = seg.meta.max_seq_no;
                        }
                        loaded_segments.push(Arc::new(seg));
                    }
                    Err(e) => {
                        eprintln!("Warning: failed to load segment {:?}: {}", seg_path, e);
                    }
                }
            }
        }

        // 3. Open WAL and replay uncommitted records (Recovery Manager)
        let active_memtable = Arc::new(ActiveMemTable::new(config.dimension));
        let wal_records = WalReader::read_all(&wal_path).unwrap_or_default();
        let mut highest_wal_seq = max_durable_seq;
        let mut recovered_count = 0;

        for rec in wal_records {
            if rec.seq_no > highest_wal_seq {
                highest_wal_seq = rec.seq_no;
            }
            if rec.seq_no > max_durable_seq {
                let _ = active_memtable.insert(rec.id, &rec.values);
                recovered_count += 1;
            }
        }

        let wal_writer = WalWriter::open(&wal_path, highest_wal_seq)?;
        let (flush_tx, flush_rx) = unbounded::<()>();
        let shutdown = Arc::new(AtomicBool::new(false));

        let immutable_queue = Arc::new(RwLock::new(VecDeque::new()));
        let segments = Arc::new(RwLock::new(loaded_segments));

        // 4. Start background segment builder thread
        let bg_immutable = Arc::clone(&immutable_queue);
        let bg_segments = Arc::clone(&segments);
        let bg_shutdown = Arc::clone(&shutdown);
        let bg_config = config.clone();
        let bg_manifest_path = manifest_path.clone();

        let bg_worker = thread::spawn(move || {
            while !bg_shutdown.load(Ordering::Relaxed) {
                // Wait for flush signal or periodic check
                let _ = flush_rx.recv_timeout(Duration::from_millis(100));

                let item_opt = {
                    let mut queue = bg_immutable.write();
                    queue.pop_front()
                };

                if let Some(immutable) = item_opt {
                    let seg_id = {
                        let current_segs = bg_segments.read();
                        current_segs.len() as u64 + 1
                    };

                    let segs_dir = bg_config.base_dir.join("segments");
                    match DiskSegment::build_and_publish(
                        &immutable,
                        &segs_dir,
                        seg_id,
                        bg_config.hnsw_config.clone(),
                    ) {
                        Ok(new_segment) => {
                            // Atomically update manifest
                            let mut manifest = Manifest::load(&bg_manifest_path).unwrap_or_default();
                            manifest.last_segment_id = seg_id;
                            if new_segment.meta.max_seq_no > manifest.max_durable_seq_no {
                                manifest.max_durable_seq_no = new_segment.meta.max_seq_no;
                            }
                            manifest.segments.push(new_segment.meta.clone());
                            let _ = manifest.atomic_save(&bg_manifest_path);

                            // Add to active segments list
                            let mut segs = bg_segments.write();
                            segs.push(new_segment);
                        }
                        Err(e) => {
                            eprintln!("Error building segment {}: {}", seg_id, e);
                            // Push back to queue to ensure Invariant INV-09: No data loss on failure
                            let mut queue = bg_immutable.write();
                            queue.push_front(immutable);
                            thread::sleep(Duration::from_millis(200));
                        }
                    }
                }
            }
        });

        let engine = Arc::new(Self {
            config,
            wal: Mutex::new(wal_writer),
            active_memtable,
            immutable_queue,
            segments,
            manifest: Mutex::new(manifest),
            flush_tx,
            bg_worker: Some(bg_worker),
            shutdown,
            total_writes: AtomicU64::new(recovered_count),
            total_queries: AtomicU64::new(0),
            current_min_seq: AtomicU64::new(max_durable_seq + 1),
            query_latencies_us: Mutex::new(Vec::with_capacity(10000)),
            last_stat_time: Mutex::new(Instant::now()),
            last_write_count: AtomicU64::new(recovered_count),
            last_query_count: AtomicU64::new(0),
            write_rate: Mutex::new(0.0),
            query_rate: Mutex::new(0.0),
        });

        Ok(engine)
    }

    /// Primary write API: Appends to WAL and inserts into Active MemTable.
    pub fn put(&self, id: VectorId, values: &[f32]) -> Result<u64, String> {
        if values.len() != self.config.dimension {
            return Err(format!(
                "Dimension mismatch: expected {}, got {}",
                self.config.dimension,
                values.len()
            ));
        }

        let seq = {
            let mut wal = self.wal.lock();
            wal.append(id, values).map_err(|e| e.to_string())?
        };

        self.active_memtable.insert(id, values)?;
        self.total_writes.fetch_add(1, Ordering::Relaxed);

        self.check_rotation(seq);
        Ok(seq)
    }

    /// High-throughput Batch Write API: Appends batch to WAL and Active MemTable.
    pub fn put_batch(&self, items: &[VectorItem]) -> Result<u64, String> {
        if items.is_empty() {
            return Ok(0);
        }

        for item in items {
            if item.values.len() != self.config.dimension {
                return Err(format!(
                    "Dimension mismatch on vector {}: expected {}, got {}",
                    item.id,
                    self.config.dimension,
                    item.values.len()
                ));
            }
        }

        let last_seq = {
            let mut wal = self.wal.lock();
            wal.append_batch(items).map_err(|e| e.to_string())?
        };

        self.active_memtable.insert_batch(items)?;
        self.total_writes.fetch_add(items.len() as u64, Ordering::Relaxed);

        self.check_rotation(last_seq);
        Ok(last_seq)
    }

    fn check_rotation(&self, current_seq: u64) {
        if self.active_memtable.len() >= self.config.memtable_threshold_count {
            self.rotate(current_seq);
        }
    }

    /// Rotate Active MemTable -> Immutable MemTable Queue
    pub fn rotate(&self, current_seq: u64) {
        let min_seq = self.current_min_seq.swap(current_seq + 1, Ordering::Relaxed);
        let seg_id = current_seq;

        let immutable = self.active_memtable.freeze(seg_id, min_seq, current_seq);
        if !immutable.is_empty() {
            {
                let mut queue = self.immutable_queue.write();
                queue.push_back(immutable);
            }
            let _ = self.flush_tx.send(());
        }
    }

    /// Concurrent Search: Searches Active MemTable, Immutable MemTables, and Published Segments.
    /// Combines results with deduplication into a global top-k list.
    pub fn search(&self, query: &[f32], k: usize) -> Vec<Neighbor> {
        let start = Instant::now();
        let ef_search = self.config.ef_search.max(k);

        // 1. Search active MemTable
        let active_candidates = self.active_memtable.search(query, k);

        // 2. Search all immutable MemTables in queue
        let immutable_candidates: Vec<Neighbor> = {
            let queue = self.immutable_queue.read();
            queue
                .iter()
                .flat_map(|im| im.search(query, k))
                .collect()
        };

        // 3. Search disk segments concurrently using Rayon parallel iterator
        let disk_segments = {
            let segs = self.segments.read();
            segs.clone()
        };

        let segment_candidates: Vec<Neighbor> = disk_segments
            .par_iter()
            .flat_map(|seg| seg.search(query, k, ef_search))
            .collect();

        // 4. Global Top-K Aggregator with Deduplication (Invariant INV-07)
        let mut seen = HashSet::with_capacity(k * 4);
        let mut min_heap: BinaryHeap<Neighbor> = BinaryHeap::with_capacity(k + 1);

        let all_candidates = active_candidates
            .into_iter()
            .chain(immutable_candidates)
            .chain(segment_candidates);

        for candidate in all_candidates {
            if seen.insert(candidate.id) {
                if min_heap.len() < k {
                    min_heap.push(candidate);
                } else if let Some(worst) = min_heap.peek() {
                    if candidate.distance < worst.distance {
                        min_heap.pop();
                        min_heap.push(candidate);
                    }
                }
            }
        }

        let mut results = min_heap.into_vec();
        results.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap_or(std::cmp::Ordering::Equal));

        let elapsed_us = start.elapsed().as_micros() as u64;
        self.total_queries.fetch_add(1, Ordering::Relaxed);

        {
            let mut latencies = self.query_latencies_us.lock();
            if latencies.len() < 50000 {
                latencies.push(elapsed_us);
            }
        }

        results
    }

    pub fn get_segment_metas(&self) -> Vec<crate::segment::SegmentMeta> {
        let segs = self.segments.read();
        segs.iter().map(|s| s.meta.clone()).collect()
    }

    /// Detailed Search: Searches Active MemTable, Immutable MemTables, and Published Segments,
    /// capturing per-target fan-out telemetry and tagging candidate source segment.
    pub fn search_detailed(&self, query: &[f32], k: usize) -> DetailedSearchResult {
        let start = Instant::now();
        let ef_search = self.config.ef_search.max(k);
        let mut fanout = Vec::new();
        let mut all_candidates: Vec<(Neighbor, String)> = Vec::new();

        // 1. Search active MemTable
        let t0 = Instant::now();
        let active_candidates = self.active_memtable.search(query, k);
        let active_us = t0.elapsed().as_micros() as u64;
        let active_count = self.active_memtable.len();
        fanout.push(SearchFanoutTarget {
            target_name: "Active MemTable".to_string(),
            target_type: "memtable".to_string(),
            vector_count: active_count,
            candidates_found: active_candidates.len(),
            latency_us: active_us,
        });
        for c in active_candidates {
            all_candidates.push((c, "Active MemTable".to_string()));
        }

        // 2. Search all immutable MemTables in queue
        let t1 = Instant::now();
        let (imm_count, imm_candidates): (usize, Vec<(Neighbor, String)>) = {
            let queue = self.immutable_queue.read();
            let count: usize = queue.iter().map(|im| im.len()).sum();
            let mut list = Vec::new();
            for (idx, im) in queue.iter().enumerate() {
                for c in im.search(query, k) {
                    list.push((c, format!("Immutable Queue #{}", idx + 1)));
                }
            }
            (count, list)
        };
        let imm_us = t1.elapsed().as_micros() as u64;
        if imm_count > 0 || !imm_candidates.is_empty() {
            fanout.push(SearchFanoutTarget {
                target_name: "Immutable Queue".to_string(),
                target_type: "immutable_queue".to_string(),
                vector_count: imm_count,
                candidates_found: imm_candidates.len(),
                latency_us: imm_us,
            });
            all_candidates.extend(imm_candidates);
        }

        // 3. Search disk segments
        let disk_segments = {
            let segs = self.segments.read();
            segs.clone()
        };

        for seg in &disk_segments {
            let t_seg = Instant::now();
            let seg_res = seg.search(query, k, ef_search);
            let seg_us = t_seg.elapsed().as_micros() as u64;
            fanout.push(SearchFanoutTarget {
                target_name: format!("Segment S-{:03}", seg.meta.segment_id),
                target_type: "hnsw_segment".to_string(),
                vector_count: seg.meta.vector_count,
                candidates_found: seg_res.len(),
                latency_us: seg_us,
            });
            for c in seg_res {
                all_candidates.push((c, format!("S-{:03}", seg.meta.segment_id)));
            }
        }

        // 4. Global Top-K Aggregator with Deduplication
        let mut seen = HashSet::with_capacity(k * 4);
        let mut min_heap: BinaryHeap<(Neighbor, String)> = BinaryHeap::with_capacity(k + 1);

        for (candidate, source) in all_candidates {
            if seen.insert(candidate.id) {
                if min_heap.len() < k {
                    min_heap.push((candidate, source));
                } else if let Some((worst, _)) = min_heap.peek() {
                    if candidate.distance < worst.distance {
                        min_heap.pop();
                        min_heap.push((candidate, source));
                    }
                }
            }
        }

        let mut results_vec = min_heap.into_vec();
        results_vec.sort_by(|(a, _), (b, _)| a.distance.partial_cmp(&b.distance).unwrap_or(std::cmp::Ordering::Equal));

        let detailed_neighbors = results_vec
            .into_iter()
            .map(|(n, source)| DetailedNeighbor {
                id: n.id,
                score: n.score,
                distance: n.distance,
                source,
            })
            .collect();

        let elapsed_us = start.elapsed().as_micros() as u64;
        self.total_queries.fetch_add(1, Ordering::Relaxed);

        {
            let mut latencies = self.query_latencies_us.lock();
            if latencies.len() < 50000 {
                latencies.push(elapsed_us);
            }
        }

        DetailedSearchResult {
            results: detailed_neighbors,
            fanout,
            total_latency_us: elapsed_us,
        }
    }

    /// Force synchronous flush of all active and immutable MemTables to disk
    pub fn flush(&self) -> io::Result<()> {
        let max_seq = {
            let wal = self.wal.lock();
            wal.current_seq_no()
        };
        self.rotate(max_seq);

        // Wait until immutable queue is fully processed
        let deadline = Instant::now() + Duration::from_secs(10);
        while Instant::now() < deadline {
            let queue_len = {
                let q = self.immutable_queue.read();
                q.len()
            };
            if queue_len == 0 {
                break;
            }
            thread::sleep(Duration::from_millis(50));
        }

        Ok(())
    }

    pub fn get_stats(&self) -> EngineStats {
        let now = Instant::now();
        let (p50, p95, p99) = {
            let mut latencies = self.query_latencies_us.lock();
            if latencies.is_empty() {
                (0.0, 0.0, 0.0)
            } else {
                latencies.sort_unstable();
                let len = latencies.len();
                let p50 = latencies[len * 50 / 100] as f64 / 1000.0;
                let p95 = latencies[len * 95 / 100] as f64 / 1000.0;
                let p99 = latencies[len * 99 / 100] as f64 / 1000.0;
                (p50, p95, p99)
            }
        };

        // Calculate QPS rates
        let total_w = self.total_writes.load(Ordering::Relaxed);
        let total_q = self.total_queries.load(Ordering::Relaxed);
        let mut last_t = self.last_stat_time.lock();
        let dt = now.duration_since(*last_t).as_secs_f64();
        let mut w_rate = self.write_rate.lock();
        let mut q_rate = self.query_rate.lock();

        if dt >= 1.0 {
            let prev_w = self.last_write_count.swap(total_w, Ordering::Relaxed);
            let prev_q = self.last_query_count.swap(total_q, Ordering::Relaxed);
            *w_rate = (total_w.saturating_sub(prev_w)) as f64 / dt;
            *q_rate = (total_q.saturating_sub(prev_q)) as f64 / dt;
            *last_t = now;
        }

        let imm_count: usize = {
            let q = self.immutable_queue.read();
            q.iter().map(|im| im.len()).sum()
        };

        let (seg_count, seg_vectors) = {
            let segs = self.segments.read();
            let count = segs.len();
            let vectors = segs.iter().map(|s| s.meta.vector_count).sum();
            (count, vectors)
        };

        let wal_size = {
            let wal = self.wal.lock();
            wal.bytes_written()
        };

        EngineStats {
            total_writes: total_w,
            active_memtable_vectors: self.active_memtable.len(),
            immutable_memtable_vectors: imm_count,
            segment_count: seg_count,
            total_segment_vectors: seg_vectors,
            wal_size_bytes: wal_size,
            total_queries: total_q,
            p50_latency_ms: p50,
            p95_latency_ms: p95,
            p99_latency_ms: p99,
            write_qps: *w_rate,
            query_qps: *q_rate,
            recovering: false,
        }
    }
}

impl Drop for VectorStorageEngine {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        let _ = self.flush_tx.send(());
        if let Some(worker) = self.bg_worker.take() {
            let _ = worker.join();
        }
    }
}
