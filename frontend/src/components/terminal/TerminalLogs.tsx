import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

export const TerminalLogs: React.FC = () => {
  const { logs, clearLogs } = useTelemetry();

  return (
    <div className="terminal-window" style={{ marginTop: '24px' }}>
      <div className="terminal-bar">
        <span className="term-title">SYSTEM LOG STREAM &bull; EVENT TRACE</span>
        <button
          className="action-btn"
          style={{ padding: '2px 8px', fontSize: '10px' }}
          onClick={clearLogs}
        >
          CLEAR
        </button>
      </div>
      <div className="terminal-body">
        {logs.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)' }}>Waiting for system events...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="term-line">
              <span className="term-time">[{log.time}]</span>
              <span className={`term-tag-${log.level}`}>[{log.level}]</span>
              <span className="term-msg">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
