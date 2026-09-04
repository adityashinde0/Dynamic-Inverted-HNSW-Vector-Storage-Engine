# PS-005: Vector Storage Benchmark Dataset
- `vectors_1k_64d.bin`: 1,000 normalized float32 vectors (raw binary) for MemTable and LSM write ingestion.
- `queries_ground_truth_knn.json`: Exact brute-force top-10 nearest neighbors for 50 queries to evaluate search recall and latency under concurrent writes.
