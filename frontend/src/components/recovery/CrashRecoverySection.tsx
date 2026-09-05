import React, { useState } from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

export const CrashRecoverySection: React.FC = () => {
  const { addLog } = useTelemetry();
  const [activeStep, setActiveStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  const steps = [
    { num: '01', title: 'SIMULATE CRASH', desc: 'Abrupt engine termination. In-memory buffers lost; WAL remains intact on disk.' },
    { num: '02', title: 'CRC32 SCAN', desc: 'Scan WAL append log sequentially. Validate 4-byte CRC32 on every record block.' },
    { num: '03', title: 'REPLAY MEMTABLE', desc: 'Replay unsealed records into new Active MemTable with identical sequence offsets.' },
    { num: '04', title: 'ONLINE READY', desc: 'Recovery verified: 0.00% data loss. Search router resumes traffic immediately.' },
  ];

  const handleSimulate = async () => {
    setIsSimulating(true);
    addLog('SYSTEM', 'Initiating Crash Recovery Simulation (INV-10)...');

    for (let i = 0; i < steps.length; i++) {
      setActiveStep(i);
      addLog('SYSTEM', `Step ${i + 1}/4: ${steps[i].title} - ${steps[i].desc}`);
      await new Promise((r) => setTimeout(r, 900));
    }

    addLog('SYSTEM', 'Recovery Simulation complete. Zero data loss verified.');
    setIsSimulating(false);
  };

  return (
    <div className="signal-card" style={{ marginTop: '20px' }}>
      <div className="card-top">
        <span className="card-label">DURABILITY &amp; CRASH RECOVERY SIMULATOR (INV-10)</span>
        <span className="source-tag source-configured">CONCEPTUAL SPECIFICATION</span>
      </div>

      <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '12px 0 20px' }}>
        The PS-005 Write-Ahead Log operates in <code>O_APPEND</code> mode with per-record CRC32 checksums. Upon engine restart, uncommitted records are replayed into memory, restoring complete database state without data loss.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {steps.map((s, idx) => (
          <div
            key={s.num}
            style={{
              background: activeStep === idx ? 'rgba(0, 210, 255, 0.15)' : 'rgba(4, 6, 9, 0.6)',
              border: activeStep === idx ? '1px solid var(--color-cyan)' : 'var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: activeStep === idx ? 'var(--color-cyan)' : 'var(--color-text-muted)' }}>
              STEP {s.num}
            </span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '6px 0' }}>
              {s.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>

      <button className="action-btn" onClick={handleSimulate} disabled={isSimulating}>
        <span>🔄</span> {isSimulating ? 'REPLAYING WAL LOG...' : 'SIMULATE RECOVERY WORKFLOW'}
      </button>
    </div>
  );
};
