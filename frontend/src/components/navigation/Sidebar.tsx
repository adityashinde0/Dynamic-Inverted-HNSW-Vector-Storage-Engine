import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenJudge: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onOpenJudge }) => {
  const { isOnline } = useTelemetry();

  const navItems = [
    { id: 'overview', label: 'Overview', glyph: '🏠' },
    { id: 'search', label: 'Search', glyph: '🔍' },
    { id: 'ingest', label: 'Ingest', glyph: '📥' },
    { id: 'segments', label: 'Segments', glyph: '📊' },
    { id: 'benchmark', label: 'Benchmark', glyph: '📈' },
    { id: 'recovery', label: 'Recovery', glyph: '🔄' },
    { id: 'system', label: 'System', glyph: '⚙️' },
  ];

  return (
    <aside className="cockpit-sidebar">
      <div>
        {/* Brand Area */}
        <div className="sidebar-brand">
          <svg className="brand-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 2,7 12,12 22,7" opacity="0.8" />
            <polygon points="2,17 12,22 22,17 12,12" opacity="0.6" />
            <polygon points="2,12 12,17 22,12 12,7" />
          </svg>
          <div className="brand-text">
            <span className="brand-name">PS-005</span>
            <span className="brand-sub">VECTOR STORAGE ENGINE</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <span className="nav-glyph">{item.glyph}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Section */}
      <div className="sidebar-footer">
        <div className="settings-btn" onClick={onOpenJudge}>
          <span>⚖️</span>
          <span>Judge Mode Audit</span>
        </div>

        <div className="engine-status-card">
          <div className="status-left">
            <span className={`pulse-dot ${!isOnline ? 'offline' : ''}`} />
            <span className="status-txt">{isOnline ? 'Engine Online' : 'Engine Offline'}</span>
          </div>
          <span className="status-ver">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
};
