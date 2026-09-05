export interface BenchmarkTargets {
  write_throughput_sla: string;
  p99_latency_sla: string;
  durability_sla: string;
  quantization_goal: string;
}

export interface EmpiricalResults {
  write_throughput_qps?: number;
  concurrent_write_qps?: number;
  p50_latency_ms?: number;
  p95_latency_ms?: number;
  p99_latency_ms?: number;
  recall_at_10?: number;
  quantization?: {
    original_bytes_per_vector: number;
    quantized_bytes_per_vector: number;
    compression_ratio: string;
    cosine_similarity_fidelity: number;
  };
  crash_recovery?: {
    records_replayed: number;
    data_loss_percentage: number;
    wal_crc32_validated: boolean;
    recovery_duration_ms: number;
  };
}

export interface BenchmarkResponse {
  status: string;
  timestamp_unix?: number;
  targets: BenchmarkTargets;
  empirical_results: EmpiricalResults;
}
