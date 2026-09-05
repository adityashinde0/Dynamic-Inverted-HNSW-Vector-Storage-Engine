import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

interface QuickActionsProps {
  onFocusSearch: () => void;
  onOpenSegments: () => void;
  onOpenBenchmark: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onFocusSearch,
  onOpenSegments,
  onOpenBenchmark,
}) => {
  const { ingestBatch } = useTelemetry();

  return (
    <div className="cockpit-panel">
      <div className="panel-header">
        <span className="panel-title">QUICK ACTIONS</span>
      </div>

      <div className="quick-actions-stack">
        <button className="quick-action-btn" onClick={() => ingestBatch(1000)}>
          <span className="qa-glyph">⬆</span>
          <span>Ingest Vectors</span>
        </button>

        <button className="quick-action-btn" onClick={onFocusSearch}>
          <span className="qa-glyph">🔍</span>
          <span>Run Search</span>
        </button>

        <button className="quick-action-btn" onClick={onOpenSegments}>
          <span className="qa-glyph">🗂</span>
          <span>View Segments</span>
        </button>

        <button className="quick-action-btn" onClick={onOpenBenchmark}>
          <span className="qa-glyph">📊</span>
          <span>Run Benchmark</span>
        </button>
      </div>
    </div>
  );
};
