import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

interface NodeInspectorDrawerProps {
  nodeKey: string | null;
  onClose: () => void;
}

export const NodeInspectorDrawer: React.FC<NodeInspectorDrawerProps> = ({ nodeKey, onClose }) => {
  const { stats, benchmarkData, segments } = useTelemetry();

  if (!nodeKey) return null;

  const bench = benchmarkData?.empirical_results;

  const renderContent = () => {
    switch (nodeKey) {
      case 'ingest':
        const writeVal = stats?.write_qps != null
          ? `${Math.round(stats.write_qps).toLocaleString()} vec/s (LIVE)`
          : bench?.write_throughput_qps
          ? `${bench.write_throughput_qps.toLocaleString()} vec/s (MEASURED)`
          : 'Target: >50,000 vec/s';
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="signal-card">
                <span className="card-label">INGEST RATE</span>
                <div className="card-val text-cyan" style={{ fontSize: '18px' }}>{writeVal}</div>
              </div>
              <div className="signal-card">
                <span className="card-label">TOTAL WRITES</span>
                <div className="card-val text-cyan" style={{ fontSize: '18px' }}>
                  {stats?.total_writes != null ? stats.total_writes.toLocaleString() : '—'}
                </div>
              </div>
            </div>
            <p><strong>Validation:</strong> Enforces 64-dimensional IEEE 754 float validation before streaming to the Rust core engine.</p>
            <p><strong>Throughput Requirement:</strong> PS-005 specification requires <strong>&gt; 50,000 vectors/second</strong> under batch ingestion with zero reader lock contention.</p>
          </>
        );

      case 'wal':
        const walKb = stats?.wal_size_bytes != null ? `${Math.round(stats.wal_size_bytes / 1024)} KB` : '0 KB';
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="signal-card">
                <span className="card-label">WAL SIZE</span>
                <div className="card-val text-cyan" style={{ fontSize: '18px' }}>{walKb}</div>
              </div>
              <div className="signal-card">
                <span className="card-label">DURABILITY</span>
                <div className="card-val text-emerald" style={{ fontSize: '18px' }}>INV-01 (100%)</div>
              </div>
            </div>
            <p><strong>Zero-Seek Append:</strong> Writes are appended sequentially to disk with 4-byte CRC32 validation before in-memory insertion.</p>
            <p><strong>Crash Recovery (INV-10):</strong> Uncommitted records are scanned sequentially and replayed into the MemTable on restart with zero data loss.</p>
          </>
        );

      case 'memtable':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="signal-card">
                <span className="card-label">ACTIVE VECTORS</span>
                <div className="card-val text-purple" style={{ fontSize: '18px' }}>
                  {stats?.active_memtable_vectors != null ? stats.active_memtable_vectors.toLocaleString() : '—'}
                </div>
              </div>
              <div className="signal-card">
                <span className="card-label">ROTATION THRESHOLD</span>
                <div className="card-val text-purple" style={{ fontSize: '18px' }}>5,000</div>
              </div>
            </div>
            <p><strong>Lock-Free Ingestion:</strong> Vectors are stored in contiguous, cache-aligned memory avoiding coarse mutex contention.</p>
            <p><strong>Atomic Swap:</strong> Reaching 5,000 vectors triggers an atomic pointer swap into the Immutable MemTable Queue.</p>
          </>
        );

      case 'immutable':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="signal-card">
                <span className="card-label">QUEUED VECTORS</span>
                <div className="card-val text-purple" style={{ fontSize: '18px' }}>
                  {stats?.immutable_memtable_vectors != null ? stats.immutable_memtable_vectors.toLocaleString() : '—'}
                </div>
              </div>
              <div className="signal-card">
                <span className="card-label">CONCURRENCY</span>
                <div className="card-val text-emerald" style={{ fontSize: '18px' }}>INV-04 (Zero)</div>
              </div>
            </div>
            <p><strong>Searchable While Frozen:</strong> Frozen MemTables remain concurrently searchable while awaiting background segment construction.</p>
          </>
        );

      case 'builder':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="signal-card">
                <span className="card-label">THREAD POOL</span>
                <div className="card-val text-amber" style={{ fontSize: '18px' }}>Rayon Parallel</div>
              </div>
              <div className="signal-card">
                <span className="card-label">QUANTIZATION</span>
                <div className="card-val text-amber" style={{ fontSize: '18px' }}>SQ8 (3.55x)</div>
              </div>
            </div>
            <p><strong>SQ8 Scalar Quantization:</strong> Compresses 32-bit floats into 8-bit integers (256 bytes down to 72 bytes), saving 72% RAM with 0.9996 cosine fidelity.</p>
          </>
        );

      case 'segments':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="signal-card">
                <span className="card-label">SEGMENT COUNT</span>
                <div className="card-val text-emerald" style={{ fontSize: '18px' }}>
                  {stats?.segment_count ?? segments.length}
                </div>
              </div>
              <div className="signal-card">
                <span className="card-label">READER ACCESS</span>
                <div className="card-val text-emerald" style={{ fontSize: '18px' }}>mmap Zero-Copy</div>
              </div>
            </div>
            <p><strong>Immutable Format (INV-05):</strong> Published segments are append-only, verified by header/footer magic and CRC32 checksums, and never modified in place.</p>
          </>
        );

      case 'topk':
      case 'hnsw-traversal':
        const p99 = stats?.p99_latency_ms != null
          ? `${stats.p99_latency_ms.toFixed(2)} ms (LIVE)`
          : bench?.p99_latency_ms != null
          ? `${bench.p99_latency_ms.toFixed(2)} ms (MEASURED)`
          : 'Target: <15.0 ms';
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="signal-card">
                <span className="card-label">P99 LATENCY</span>
                <div className="card-val text-emerald" style={{ fontSize: '18px' }}>{p99}</div>
              </div>
              <div className="signal-card">
                <span className="card-label">FAN-OUT</span>
                <div className="card-val text-emerald" style={{ fontSize: '18px' }}>Rayon Multi-Core</div>
              </div>
            </div>
            <p><strong>Rayon Parallel Fan-Out:</strong> Simultaneously searches the Active MemTable and all disk segments, merging candidates into a deduplicated min-heap.</p>
          </>
        );

      default:
        return <p>Select an architectural subsystem to view invariants.</p>;
    }
  };

  const getTitle = () => {
    switch (nodeKey) {
      case 'ingest': return 'Vector Ingestion Subsystem';
      case 'wal': return 'Write-Ahead Log (WAL)';
      case 'memtable': return 'Active MemTable Reservoir';
      case 'immutable': return 'Immutable MemTable Queue';
      case 'builder': return 'Segment Builder & Quantization';
      case 'segments': return 'Immutable Disk Segments';
      case 'topk':
      case 'hnsw-traversal': return 'Search Router & Top-K Fan-Out';
      default: return 'Subsystem Inspector';
    }
  };

  return (
    <aside className="inspector-drawer">
      <div className="drawer-header">
        <h3>{getTitle()}</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      <div className="drawer-body">{renderContent()}</div>
    </aside>
  );
};
