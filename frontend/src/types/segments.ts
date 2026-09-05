export interface SegmentMeta {
  segment_id: number;
  vector_count: number;
  dimension: number;
  min_seq_no: number;
  max_seq_no: number;
  file_path: string;
  size_bytes: number;
  crc32: string;
  created_at_unix: number;
  status: string;
  quantization: string;
  hnsw_indexed: boolean;
}
