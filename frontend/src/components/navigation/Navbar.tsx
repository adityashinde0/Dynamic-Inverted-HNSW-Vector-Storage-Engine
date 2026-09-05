import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

interface NavbarProps {
  onOpenJudge: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenJudge }) => {
  const { isOnline, telemetryState, staleSeconds } = useTelemetry();

  return (
    <header className="main-navbar">
      <div className="brand-area">
        <svg className="brand-logo" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,2 2,7 12,12 22,7" opacity="0.8" />
          <polygon points="2,17 12,22 22,17 12,12" opacity="0.6" />
          <polygon points="2,12 12,17 22,12 12,7" />
        </svg>
        <span className="brand-title">PS-005 VECTOR CONTROL ROOM</span>
        <span className="brand-badge">HNSW LSM-TREE</span>
      </div>

      <nav className="nav-links">
        <a href="#architecture">ARCHITECTURE</a>
        <a href="#system-state">TELEMETRY</a>
        <a href="#vector-search">SEARCH</a>
        <a href="#segments-view">SEGMENTS</a>
        <a href="#benchmark-audit">BENCHMARK</a>
        <a href="#crash-recovery">DURABILITY</a>
      </nav>

      <div className="nav-status-group">
        <div className={`system-status-pill ${!isOnline ? 'status-offline' : ''}`}>
          <span className="pulse-dot"></span>
          <span>{isOnline ? 'ENGINE: ONLINE' : 'ENGINE: OFFLINE'}</span>
        </div>

        <div className={`telemetry-status-pill status-${telemetryState.toLowerCase()}`}>
          <span>
            {telemetryState === 'LIVE'
              ? '● TELEMETRY: LIVE'
              : telemetryState === 'STALE'
              ? `○ TELEMETRY: STALE (${staleSeconds}s)`
              : '○ TELEMETRY: UNAVAILABLE'}
          </span>
        </div>

        <button className="action-btn" onClick={onOpenJudge}>
          <span>⚖️</span> JUDGE AUDIT
        </button>
      </div>
    </header>
  );
};
