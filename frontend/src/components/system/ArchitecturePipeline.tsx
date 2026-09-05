import React from 'react';

interface ArchitecturePipelineProps {
  onSelectNode: (nodeKey: string) => void;
  telemetryLive: boolean;
}

export const ArchitecturePipeline: React.FC<ArchitecturePipelineProps> = ({
  onSelectNode,
  telemetryLive,
}) => {
  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          INTERACTIVE LSM STORAGE PIPELINE &bull; CLICK ANY COMPONENT TO AUDIT INVARIANTS
        </span>
        <span
          className="source-tag"
          style={{
            background: telemetryLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            color: telemetryLive ? 'var(--color-emerald)' : 'var(--color-text-muted)',
            border: telemetryLive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {telemetryLive ? '● LIVE DUAL STREAM ACTIVE' : 'CALM AMBIENT TOPOLOGY'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
        {/* Step 1: Ingestion */}
        <div
          className="signal-card"
          style={{ cursor: 'pointer', borderColor: 'rgba(0, 210, 255, 0.3)' }}
          onClick={() => onSelectNode('ingest')}
        >
          <div className="card-top">
            <span className="card-label">01 &bull; INGESTION</span>
            <span className="source-tag source-live">gRPC</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-cyan)', margin: '6px 0' }}>
            Batch Receiver
          </div>
          <div className="card-footer">64-dim Float32</div>
        </div>

        {/* Step 2: WAL */}
        <div
          className="signal-card"
          style={{ cursor: 'pointer', borderColor: 'rgba(0, 210, 255, 0.3)' }}
          onClick={() => onSelectNode('wal')}
        >
          <div className="card-top">
            <span className="card-label">02 &bull; WAL</span>
            <span className="source-tag source-live">CRC32</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-cyan)', margin: '6px 0' }}>
            Append Log
          </div>
          <div className="card-footer">INV-01 (100% SLA)</div>
        </div>

        {/* Step 3: Active MemTable */}
        <div
          className="signal-card"
          style={{ cursor: 'pointer', borderColor: 'rgba(168, 85, 247, 0.3)' }}
          onClick={() => onSelectNode('memtable')}
        >
          <div className="card-top">
            <span className="card-label">03 &bull; MEMTABLE</span>
            <span className="source-tag source-configured">LOCK-FREE</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-purple)', margin: '6px 0' }}>
            SIMD Reservoir
          </div>
          <div className="card-footer">Atomic Swap at 5k</div>
        </div>

        {/* Step 4: Immutable MemTable */}
        <div
          className="signal-card"
          style={{ cursor: 'pointer', borderColor: 'rgba(168, 85, 247, 0.3)' }}
          onClick={() => onSelectNode('immutable')}
        >
          <div className="card-top">
            <span className="card-label">04 &bull; IMMUTABLE</span>
            <span className="source-tag source-configured">QUEUE</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-purple)', margin: '6px 0' }}>
            Frozen Buffer
          </div>
          <div className="card-footer">INV-04 (0 Contention)</div>
        </div>

        {/* Step 5: Segment Builder */}
        <div
          className="signal-card"
          style={{ cursor: 'pointer', borderColor: 'rgba(245, 158, 11, 0.3)' }}
          onClick={() => onSelectNode('builder')}
        >
          <div className="card-top">
            <span className="card-label">05 &bull; BUILDER</span>
            <span className="source-tag source-configured">SQ8 / RAYON</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-amber)', margin: '6px 0' }}>
            HNSW Indexer
          </div>
          <div className="card-footer">3.55x Compression</div>
        </div>

        {/* Step 6: Immutable Disk Segments */}
        <div
          className="signal-card"
          style={{ cursor: 'pointer', borderColor: 'rgba(16, 185, 129, 0.3)' }}
          onClick={() => onSelectNode('segments')}
        >
          <div className="card-top">
            <span className="card-label">06 &bull; SEGMENTS</span>
            <span className="source-tag source-configured">MMAP</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-emerald)', margin: '6px 0' }}>
            VSEG Files
          </div>
          <div className="card-footer">INV-05 (Zero Copy)</div>
        </div>
      </div>
    </div>
  );
};
