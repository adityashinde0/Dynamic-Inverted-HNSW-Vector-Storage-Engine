import React, { useState } from 'react';
import { apiClient } from '../../data/api/client';
import { SearchResponse } from '../../types/search';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

export const KnnQueryPlayground: React.FC = () => {
  const { addLog } = useTelemetry();
  const [queryIndex, setQueryIndex] = useState<number>(0);
  const [topK, setTopK] = useState<number>(10);
  const [isSearching, setIsSearching] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    { idx: 0, label: 'Query Vector #000 (Dataset Seed)' },
    { idx: 42, label: 'Query Vector #042 (High Dimensional Cluster)' },
    { idx: 108, label: 'Query Vector #108 (Outlier Boundary Vector)' },
  ];

  const handleSearch = async (idxToUse?: number) => {
    const idx = idxToUse !== undefined ? idxToUse : queryIndex;
    setIsSearching(true);
    setError(null);
    addLog('QUERY', `Executing k-NN search for vector query index ${idx} with k=${topK}...`);

    try {
      const res = await apiClient.executeQuery({ query_index: idx, k: topK });
      setResponse(res);
      addLog('QUERY', `Query executed in ${res.latency_ms.toFixed(2)}ms. Recall: ${res.recall_at_10 ? (res.recall_at_10 * 100).toFixed(1) + '%' : 'N/A'}`);
    } catch (err: any) {
      setError(err.message || 'Engine unreachable.');
      addLog('WARN', `Search failed: Engine unreachable.`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="signal-card" style={{ marginTop: '20px' }}>
      <div className="card-top">
        <span className="card-label">CONCURRENT K-NN SEARCH PLAYGROUND</span>
        <span className="source-tag source-live">REAL /API/QUERY</span>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {presets.map((p) => (
            <button
              key={p.idx}
              className={`action-btn ${queryIndex === p.idx ? 'active' : ''}`}
              style={{
                fontSize: '11px',
                background: queryIndex === p.idx ? 'rgba(0, 210, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                color: queryIndex === p.idx ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
              }}
              onClick={() => {
                setQueryIndex(p.idx);
                handleSearch(p.idx);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            K:
          </label>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            style={{
              background: '#090d14',
              border: 'var(--border-subtle)',
              color: 'var(--color-text-primary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>

          <button className="action-btn" onClick={() => handleSearch()} disabled={isSearching}>
            <span>🔍</span> {isSearching ? 'SEARCHING...' : 'RUN SEARCH'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          <strong>SEARCH SERVICE UNAVAILABLE:</strong> The engine did not return a response ({error}). Ensure the Rust backend is running.
        </div>
      )}

      {response && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            <span>
              LATENCY: <strong className="text-emerald">{response.latency_ms.toFixed(2)} ms</strong> &bull;
              RECALL@10: <strong className="text-cyan">{response.recall_at_10 != null ? `${(response.recall_at_10 * 100).toFixed(1)}%` : 'Target >95%'}</strong>
            </span>
            <span>FAN-OUT: ACTIVE MEMTABLE + {response.fanout_stats?.segments_searched || 0} SEGMENTS</span>
          </div>

          <table className="cinematic-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>VECTOR ID</th>
                <th>L2 DISTANCE</th>
                <th>COSINE SIMILARITY</th>
                <th>GROUND TRUTH MATCH</th>
              </tr>
            </thead>
            <tbody>
              {response.results.map((item, idx) => {
                const isGtMatch = response.ground_truth_top10?.includes(item.id);
                return (
                  <tr key={item.id}>
                    <td>#{idx + 1}</td>
                    <td className="text-cyan font-mono">{item.id}</td>
                    <td className="font-mono">{item.distance.toFixed(4)}</td>
                    <td className="text-emerald font-mono">{(1.0 / (1.0 + item.distance)).toFixed(4)}</td>
                    <td>
                      {isGtMatch ? (
                        <span className="source-tag source-live">MATCH (EXACT)</span>
                      ) : (
                        <span className="source-tag source-unavailable">APPROX</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
