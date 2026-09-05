import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';
import { Sparkline } from '../../visualization/canvas/Sparkline';

export const TelemetryCharts: React.FC = () => {
  const { latencyHistory, throughputHistory, ingestBatch, flushMemtable } = useTelemetry();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
      {/* Latency History Card */}
      <div className="signal-card">
        <div className="card-top">
          <span className="card-label">SEARCH LATENCY SPARKLINE (P50 / P95 / P99)</span>
          <span className="source-tag source-live">10Hz TELEMETRY</span>
        </div>
        <Sparkline type="latency" data={latencyHistory} />
        <div className="card-footer" style={{ marginTop: '8px' }}>
          <span className="text-muted">SLATE: P50 &bull; AMBER: P95 &bull; EMERALD: P99</span>
          <span className="text-red">15.0ms SLA THRESHOLD</span>
        </div>
      </div>

      {/* Throughput History Card */}
      <div className="signal-card">
        <div className="card-top">
          <span className="card-label">THROUGHPUT TRACE (WRITE QPS VS QUERY QPS)</span>
          <span className="source-tag source-live">REAL-TIME</span>
        </div>
        <Sparkline type="throughput" data={throughputHistory} />
        <div className="card-footer" style={{ marginTop: '8px' }}>
          <span className="text-cyan">CYAN: WRITE QPS &bull; PURPLE: QUERY QPS</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="action-btn" onClick={() => ingestBatch(1000)}>
              <span>⚡</span> INJECT 1K
            </button>
            <button className="action-btn" onClick={() => flushMemtable()}>
              <span>🔄</span> FLUSH
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
