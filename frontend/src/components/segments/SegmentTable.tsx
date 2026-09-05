import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

export const SegmentTable: React.FC = () => {
  const { segments, fetchSegments } = useTelemetry();

  return (
    <div className="signal-card" style={{ marginTop: '20px' }}>
      <div className="card-top">
        <span className="card-label">IMMUTABLE DISK SEGMENT REPOSITORY</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="source-tag source-configured">VSEG / SQ8</span>
          <button className="action-btn" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={fetchSegments}>
            REFRESH
          </button>
        </div>
      </div>

      {segments.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          NO COMMITTED DISK SEGMENTS YET &bull; TRIGGER BATCH INGESTION &amp; FLUSH TO SEAL ACTIVE MEMTABLE
        </div>
      ) : (
        <table className="cinematic-table" style={{ marginTop: '12px' }}>
          <thead>
            <tr>
              <th>SEGMENT ID</th>
              <th>VECTOR COUNT</th>
              <th>DIMENSION</th>
              <th>SEQUENCE RANGE</th>
              <th>FILE SIZE</th>
              <th>CRC32</th>
              <th>QUANTIZATION</th>
              <th>INDEX STATUS</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => (
              <tr key={seg.segment_id}>
                <td className="text-cyan font-mono">seg-{String(seg.segment_id).padStart(3, '0')}</td>
                <td className="font-mono">{seg.vector_count.toLocaleString()}</td>
                <td>{seg.dimension}-dim Float32</td>
                <td className="font-mono text-muted">[{seg.min_seq_no}..{seg.max_seq_no}]</td>
                <td className="font-mono">{Math.round(seg.size_bytes / 1024)} KB</td>
                <td className="font-mono text-emerald">{seg.crc32}</td>
                <td><span className="source-tag source-configured">{seg.quantization}</span></td>
                <td><span className="source-tag source-live">MMAP SEARCHABLE</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
