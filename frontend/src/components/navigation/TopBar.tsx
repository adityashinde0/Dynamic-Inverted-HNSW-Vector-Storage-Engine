import React, { useState, useEffect } from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

export const TopBar: React.FC = () => {
  const { isOnline } = useTelemetry();
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="cockpit-topbar">
      <span className="topbar-tagline">
        STORE &bull; SEARCH &bull; SCALE &bull; REAL-TIME
      </span>

      <div className="topbar-utility">
        <div className="health-indicator">
          <span className={`dot ${!isOnline ? 'offline' : ''}`} style={{ background: isOnline ? 'var(--color-emerald)' : 'var(--color-red)' }} />
          <span>{isOnline ? 'Engine Healthy' : 'Engine Offline'}</span>
          <span className="time">| {timeStr}</span>
        </div>

        <div className="live-system-pill">
          <span>▶</span>
          <span>Live System</span>
        </div>
      </div>
    </header>
  );
};
