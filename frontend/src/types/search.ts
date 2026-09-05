export interface SearchResultItem {
  id: number;
  distance: number;
  score?: number;
}

export interface FanoutStats {
  memtable_searched: boolean;
  segments_searched: number;
  candidates_merged: number;
  fanout_latency_ms: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  latency_ms: number;
  fanout_stats?: FanoutStats;
  recall_at_10?: number;
  ground_truth_top10?: number[];
}

export interface QueryPreset {
  id: string;
  name: string;
  category: string;
  queryIndex?: number;
  vector?: number[];
  description: string;
}
