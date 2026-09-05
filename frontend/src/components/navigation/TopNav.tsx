import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

interface TopNavProps {
  onOpenJudge: () => void;
  onNavigate: (sectionId: string) => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onOpenJudge, onNavigate }) => {
  const { isOnline } = useTelemetry();

  return (
    <nav className="minimal-top-nav">
      {/* Brand */}
      <div className="nav-brand-group">
        <svg className="brand-logo-svg" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,2 2,7 12,12 22,7" opacity="0.8" />
          <polygon points="2,17 12,22 22,17 12,12" opacity="0.6" />
          <polygon points="2,12 12,17 22,12 12,7" />
        </svg>
        <div className="brand-title-wrap">
          <span className="brand-title">PS-005</span>
          <span className="brand-subtitle">VECTOR STORAGE ENGINE</span>
        </div>
      </div>

      {/* Center Links */}
      <div className="nav-links-center">
        <span className="nav-anchor" onClick={() => onNavigate('hero-top')}>Overview</span>
        <span className="nav-anchor" onClick={() => onNavigate('search-section')}>Search</span>
        <span className="nav-anchor" onClick={() => onNavigate('search-section')}>Ingest</span>
        <span className="nav-anchor" onClick={() => onNavigate('segments-section')}>Segments</span>
        <span className="nav-anchor" onClick={() => onNavigate('benchmark-section')}>Benchmark</span>
        <span className="nav-anchor" onClick={() => onNavigate('recovery-section')}>Recovery</span>
      </div>

      {/* Right Engine Status & Subsystem Readouts */}
      <div className="nav-status-right">
        <div className="subsystem-indicators">
          <span className="subsystem-badge">
            <span className="sub-key">WAL</span>
            <span className={`sub-val ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'READY' : 'OFFLINE'}</span>
          </span>
          <span className="subsystem-badge">
            <span className="sub-key">MEMTABLE</span>
            <span className={`sub-val ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'ACTIVE' : 'OFFLINE'}</span>
          </span>
          <span className="subsystem-badge">
            <span className="sub-key">HNSW</span>
            <span className={`sub-val ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'READY' : 'OFFLINE'}</span>
          </span>
          <span className="subsystem-badge">
            <span className="sub-key">SEARCH</span>
            <span className={`sub-val ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'READY' : 'OFFLINE'}</span>
          </span>
        </div>

        <div className={`engine-status-pill ${!isOnline ? 'offline' : ''}`}>
          <span className="pulse-dot" />
          <span>{isOnline ? 'ENGINE ONLINE' : 'ENGINE OFFLINE'}</span>
        </div>

        <button className="judge-audit-btn" onClick={onOpenJudge} title="Open Judge Mode Audit">
          <span>⚖️</span>
          <span>JUDGE AUDIT</span>
        </button>
      </div>
    </nav>
  );
};
