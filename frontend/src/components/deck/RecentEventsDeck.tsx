import React from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

interface EventRow {
  id: string;
  title: string;
  meta: string;
  time: string;
  dotColor: 'emerald' | 'cyan' | 'amber' | 'purple';
}

export const RecentEventsDeck: React.FC = () => {
  const { logs } = useTelemetry();

  const defaultEvents: EventRow[] = [
    { id: '1', title: 'Segment created', meta: 'seg_20250425_1432', time: '2s ago', dotColor: 'emerald' },
    { id: '2', title: 'Query completed', meta: 'latency: 8.7ms, top-k: 10', time: '12s ago', dotColor: 'cyan' },
    { id: '3', title: 'Ingested 1,024 vectors', meta: 'batch_7f3a2c', time: '28s ago', dotColor: 'emerald' },
    { id: '4', title: 'MemTable rotation', meta: 'Created segment seg_20250425_1431', time: '1m ago', dotColor: 'amber' },
    { id: '5', title: 'Benchmark completed', meta: 'P99: 8.4ms, Recall@10: 0.982', time: '5m ago', dotColor: 'cyan' },
    { id: '6', title: 'System health check', meta: 'All systems operational', time: '5m ago', dotColor: 'emerald' },
  ];

  // Merge real telemetry logs if available
  const displayEvents: EventRow[] = logs.length > 0
    ? logs.slice(-6).reverse().map((l, i) => {
        let dot: 'emerald' | 'cyan' | 'amber' | 'purple' = 'emerald';
        if (l.level === 'QUERY') dot = 'cyan';
        else if (l.level === 'WARN') dot = 'amber';
        else if (l.level === 'BENCH') dot = 'purple';
        return {
          id: `log-${i}`,
          title: l.level === 'INGEST' ? 'Ingested Batch' : l.level === 'QUERY' ? 'Query Executed' : l.level,
          meta: l.message,
          time: l.time,
          dotColor: dot,
        };
      })
    : defaultEvents;

  return (
    <div className="cockpit-panel">
      <div className="panel-header">
        <span className="panel-title">RECENT EVENTS</span>
        <span className="panel-action">View All &rarr;</span>
      </div>

      <div className="recent-events-feed">
        {displayEvents.map((evt) => (
          <div key={evt.id} className="event-item">
            <div className="event-info">
              <span className={`event-dot dot-${evt.dotColor}`} />
              <div className="event-desc">
                <span className="event-title">{evt.title}</span>
                <span className="event-meta">{evt.meta}</span>
              </div>
            </div>
            <span className="event-time">{evt.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
