import { EngineStats } from '../../types/telemetry';
import { SegmentMeta } from '../../types/segments';
import { BenchmarkResponse } from '../../types/benchmark';
import { SearchResponse } from '../../types/search';

const API_BASE = typeof window !== 'undefined' && window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://127.0.0.1:8080';

const TIMEOUT_MS = 4000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export const apiClient = {
  getBaseUrl(): string {
    return API_BASE;
  },

  getWsUrl(): string {
    return API_BASE.replace(/^http/, 'ws');
  },

  async getStats(): Promise<EngineStats> {
    const res = await fetchWithTimeout(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getSegments(): Promise<SegmentMeta[]> {
    const res = await fetchWithTimeout(`${API_BASE}/api/segments`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getBenchmark(): Promise<BenchmarkResponse> {
    const res = await fetchWithTimeout(`${API_BASE}/api/benchmark`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async executeQuery(payload: { query_index?: number; vector?: number[]; k?: number }): Promise<SearchResponse> {
    const res = await fetchWithTimeout(`${API_BASE}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async ingestBatch(count: number = 1000): Promise<{ count: number; total_writes: number }> {
    const res = await fetchWithTimeout(`${API_BASE}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async flushMemtable(): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithTimeout(`${API_BASE}/api/flush`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
