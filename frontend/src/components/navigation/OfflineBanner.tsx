import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useTelemetry();

  if (isOnline) return null;

  return (
    <div className="offline-banner">
      <div className="offline-indicator">
        <span className="pulse-dot"></span>
        <span>
          <strong>PS-005 VECTOR ENGINE • ENGINE OFFLINE</strong> &bull; Core server on <code>127.0.0.1:8080</code> is not reachable. All metrics display truthful fallback states.
        </span>
      </div>
      <button
        className="action-btn"
        style={{ padding: '3px 10px', fontSize: '10px' }}
        onClick={() => window.location.reload()}
      >
        RETRY CONNECTION
      </button>
    </div>
  );
};
