import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

export const SignalCardGrid: React.FC = () => {
  const { normalized } = useTelemetry();

  return (
    <div className="signal-cards-grid">
      {/* 1. Write Throughput */}
      <div className="signal-card">
        <div className="card-top">
          <span className="card-label">WRITE THROUGHPUT</span>
          <span className={`source-tag source-${normalized.writeRate.state.toLowerCase()}`}>
            {normalized.writeRate.sourceLabel}
          </span>
        </div>
        <div className="card-val text-cyan">
          {normalized.writeRate.value !== null
            ? `${Math.round(normalized.writeRate.value).toLocaleString()} vec/s`
            : '—'}
        </div>
        <div className="card-footer">
          <span>TARGET: {normalized.writeRate.target}</span>
          <span className="text-emerald">RAYON LOCK-FREE</span>
        </div>
      </div>

      {/* 2. Search Latency P99 */}
      <div className="signal-card">
        <div className="card-top">
          <span className="card-label">SEARCH LATENCY (P99)</span>
          <span className={`source-tag source-${normalized.p99Latency.state.toLowerCase()}`}>
            {normalized.p99Latency.sourceLabel}
          </span>
        </div>
        <div className="card-val text-emerald">
          {normalized.p99Latency.value !== null
            ? `${normalized.p99Latency.value.toFixed(2)} ms`
            : '—'}
        </div>
        <div className="card-footer">
          <span>TARGET: {normalized.p99Latency.target}</span>
          <span className="text-emerald">RAYON FAN-OUT</span>
        </div>
      </div>

      {/* 3. Active MemTable */}
      <div className="signal-card">
        <div className="card-top">
          <span className="card-label">ACTIVE MEMTABLE</span>
          <span className={`source-tag source-${normalized.activeMemtable.state.toLowerCase()}`}>
            {normalized.activeMemtable.sourceLabel}
          </span>
        </div>
        <div className="card-val text-purple">
          {normalized.activeMemtable.value !== null
            ? `${normalized.activeMemtable.value.toLocaleString()} vec`
            : '—'}
        </div>
        <div className="card-footer">
          <span>CAPACITY: {normalized.memtableFillPct.toFixed(0)}%</span>
          <span>ROTATION AT 5K</span>
        </div>
      </div>

      {/* 4. Immutable Segments */}
      <div className="signal-card">
        <div className="card-top">
          <span className="card-label">DISK SEGMENTS</span>
          <span className={`source-tag source-${normalized.immutableSegments.state.toLowerCase()}`}>
            {normalized.immutableSegments.sourceLabel}
          </span>
        </div>
        <div className="card-val text-amber">
          {normalized.immutableSegments.value !== null
            ? `${normalized.immutableSegments.value} SEG`
            : '—'}
        </div>
        <div className="card-footer">
          <span>FORMAT: VSEG (SQ8)</span>
          <span className="text-amber">CRC32 VERIFIED</span>
        </div>
      </div>

      {/* 5. Durability SLA */}
      <div className="signal-card">
        <div className="card-top">
          <span className="card-label">DURABILITY SLA</span>
          <span className="source-tag source-configured">CRC32 WAL (INV-01)</span>
        </div>
        <div className="card-val text-emerald">100%</div>
        <div className="card-footer">
          <span>ZERO DATA LOSS</span>
          <span className="text-emerald">RECOVERY REPLAY</span>
        </div>
      </div>
    </div>
  );
};
