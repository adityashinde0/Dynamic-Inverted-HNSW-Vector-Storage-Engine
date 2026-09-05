import React, { useState } from 'react';
import { apiClient } from '../../data/api/client';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

interface SearchItem {
  id: number;
  text: string;
  score: number;
}

export const SearchPlaygroundDeck: React.FC = () => {
  const { addLog } = useTelemetry();
  const [queryText, setQueryText] = useState('AI infrastructure for vector search');
  const [topK, setTopK] = useState(10);
  const [metric, setMetric] = useState('Cosine Similarity');
  const [showVisualPath, setShowVisualPath] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const [results, setResults] = useState<SearchItem[]>([
    { id: 1, text: 'AI infrastructure for the next decade', score: 0.982 },
    { id: 2, text: 'Scalable vector search at billion scale', score: 0.976 },
    { id: 3, text: 'Real-time ML applications', score: 0.961 },
    { id: 4, text: 'High-performance storage engine', score: 0.948 },
    { id: 5, text: 'Vector databases in production', score: 0.934 },
  ]);

  const handleSearch = async () => {
    setIsSearching(true);
    addLog('QUERY', `Executing search query: "${queryText.slice(0, 32)}..."`);

    try {
      const res = await apiClient.executeQuery({ query_index: 0, k: topK });
      addLog('QUERY', `Search executed in ${res.latency_ms.toFixed(2)}ms`);

      if (res.results && res.results.length > 0) {
        const mapped = res.results.slice(0, 5).map((r, idx) => ({
          id: idx + 1,
          text: `Vector neighbor #${r.id} (L2: ${r.distance.toFixed(3)})`,
          score: Number((1.0 / (1.0 + r.distance)).toFixed(3)),
        }));
        setResults(mapped);
      }
    } catch {
      addLog('WARN', 'Query error: Storage engine offline.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="cockpit-panel" id="search-playground-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">SEARCH PLAYGROUND</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Search your vectors in real-time
          </div>
        </div>
      </div>

      {/* Input Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Enter a query (text or vector)..."
          style={{
            flex: 1,
            background: 'rgba(4, 7, 13, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Outfit, sans-serif',
            outline: 'none',
          }}
        />
        <button
          className="cta-primary"
          style={{ padding: '8px 16px', fontSize: '12px' }}
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Secondary Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div>
            <span style={{ marginRight: '6px' }}>Top K</span>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={{
                background: '#04070d',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

          <div>
            <span style={{ marginRight: '6px' }}>Metric</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              style={{
                background: '#04070d',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              <option value="Cosine Similarity">Cosine Similarity</option>
              <option value="L2 Distance">L2 Distance</option>
              <option value="Dot Product">Dot Product</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Show Visual Path</span>
          <input
            type="checkbox"
            checked={showVisualPath}
            onChange={(e) => setShowVisualPath(e.target.checked)}
            style={{ accentColor: 'var(--color-cyan)', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Results Header */}
      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
        Results
      </div>

      {/* Results List */}
      <div className="search-results-list">
        {results.map((res) => (
          <div key={res.id} className="search-result-row">
            <div className="res-left">
              <span className="res-rank">{res.id}</span>
              <span className="res-text">{res.text}</span>
            </div>
            <span
              className="res-score"
              style={{ color: res.score >= 0.97 ? 'var(--color-emerald)' : 'var(--color-cyan)' }}
            >
              {res.score.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
