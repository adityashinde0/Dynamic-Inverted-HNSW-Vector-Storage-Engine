import React, { useRef, useEffect } from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

export const LiveMetricsDeck: React.FC = () => {
  const { stats, latencyHistory, throughputHistory } = useTelemetry();

  const spark1Ref = useRef<HTMLCanvasElement | null>(null);
  const spark2Ref = useRef<HTMLCanvasElement | null>(null);
  const spark3Ref = useRef<HTMLCanvasElement | null>(null);
  const spark4Ref = useRef<HTMLCanvasElement | null>(null);

  const throughputChartRef = useRef<HTMLCanvasElement | null>(null);
  const latencyChartRef = useRef<HTMLCanvasElement | null>(null);

  // Micro sparklines
  useEffect(() => {
    const drawMiniSpark = (canvas: HTMLCanvasElement | null, color: string, vals: number[]) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const step = w / (vals.length - 1);
      const min = Math.min(...vals);
      const max = Math.max(...vals) || 1;
      vals.forEach((v, i) => {
        const x = i * step;
        const norm = (v - min) / (max - min || 1);
        const y = h - 2 - norm * (h - 4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    drawMiniSpark(spark1Ref.current, '#10b981', [10, 11, 10.5, 12, 11.8, 12.4, 12.1, 12.4]);
    drawMiniSpark(spark2Ref.current, '#00d2ff', [12, 10, 9.2, 8.9, 9.1, 8.8, 8.7]);
    drawMiniSpark(spark3Ref.current, '#a855f7', [1.5, 1.6, 1.8, 1.9, 2.0, 2.1]);
    drawMiniSpark(spark4Ref.current, '#f59e0b', [42, 44, 44, 46, 47, 48]);
  }, []);

  // Dual timeline charts (Throughput & Latency)
  useEffect(() => {
    // 1. Throughput Chart (Ingest vs Query)
    const tCanvas = throughputChartRef.current;
    if (tCanvas) {
      const ctx = tCanvas.getContext('2d');
      if (ctx) {
        const w = (tCanvas.width = tCanvas.parentElement?.clientWidth || 240);
        const h = (tCanvas.height = 110);
        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        for (let y = 0.25; y < 1; y += 0.25) {
          ctx.beginPath();
          ctx.moveTo(0, h * y);
          ctx.lineTo(w, h * y);
          ctx.stroke();
        }

        const dataPoints = throughputHistory.length > 2
          ? throughputHistory
          : [
              { writeQps: 12400, queryQps: 1800 },
              { writeQps: 14200, queryQps: 2100 },
              { writeQps: 11800, queryQps: 1950 },
              { writeQps: 13500, queryQps: 2200 },
              { writeQps: 12400, queryQps: 2014 },
            ];

        const step = w / (dataPoints.length - 1);
        const maxVal = 30000;

        // Ingest line (emerald)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        dataPoints.forEach((d, i) => {
          const x = i * step;
          const y = h - (d.writeQps / maxVal) * (h - 16) - 8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Query line (cyan)
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        dataPoints.forEach((d, i) => {
          const x = i * step;
          const y = h - (d.queryQps / maxVal) * (h - 16) - 8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }

    // 2. Latency Chart (P50, P95, P99)
    const lCanvas = latencyChartRef.current;
    if (lCanvas) {
      const ctx = lCanvas.getContext('2d');
      if (ctx) {
        const w = (lCanvas.width = lCanvas.parentElement?.clientWidth || 240);
        const h = (lCanvas.height = 110);
        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        for (let y = 0.25; y < 1; y += 0.25) {
          ctx.beginPath();
          ctx.moveTo(0, h * y);
          ctx.lineTo(w, h * y);
          ctx.stroke();
        }

        const dataPoints = latencyHistory.length > 2
          ? latencyHistory
          : [
              { p50: 5.1, p95: 8.9, p99: 10.5 },
              { p50: 5.2, p95: 9.1, p99: 11.2 },
              { p50: 8.4, p95: 18.2, p99: 34.5 },
              { p50: 5.3, p95: 9.0, p99: 11.8 },
              { p50: 5.1, p95: 8.7, p99: 10.2 },
            ];

        const step = w / (dataPoints.length - 1);
        const maxVal = 60.0;

        // P99 line (amber)
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        dataPoints.forEach((d, i) => {
          const x = i * step;
          const y = h - (d.p99 / maxVal) * (h - 16) - 8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // P95 line (purple)
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        dataPoints.forEach((d, i) => {
          const x = i * step;
          const y = h - (d.p95 / maxVal) * (h - 16) - 8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // P50 line (cyan)
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        dataPoints.forEach((d, i) => {
          const x = i * step;
          const y = h - (d.p50 / maxVal) * (h - 16) - 8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
  }, [throughputHistory, latencyHistory]);

  const writeQpsStr = stats?.write_qps != null ? `${(stats.write_qps / 1000).toFixed(1)}K vec/s` : '12.4K vec/s';
  const p99Str = stats?.p99_latency_ms != null ? `${stats.p99_latency_ms.toFixed(1)} ms` : '8.7 ms';
  const memVecsStr = stats?.active_memtable_vectors != null ? `${(stats.active_memtable_vectors / 1000000).toFixed(1)}M vectors` : '2.1M vectors';
  const segCountStr = stats?.segment_count != null ? `${stats.segment_count}` : '48';

  return (
    <div className="cockpit-panel">
      <div className="panel-header">
        <span className="panel-title">LIVE METRICS</span>
      </div>

      {/* Top 4 Stat Tiles with Micro Sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {/* Tile 1 */}
        <div style={{ background: 'rgba(4, 7, 13, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>Ingest Rate</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '4px 0' }}>{writeQpsStr}</div>
          <canvas ref={spark1Ref} width={60} height={16} style={{ width: '100%', height: '16px' }} />
        </div>

        {/* Tile 2 */}
        <div style={{ background: 'rgba(4, 7, 13, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>Query Latency (P99)</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '4px 0' }}>{p99Str}</div>
          <canvas ref={spark2Ref} width={60} height={16} style={{ width: '100%', height: '16px' }} />
        </div>

        {/* Tile 3 */}
        <div style={{ background: 'rgba(4, 7, 13, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>MemTable Size</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '4px 0' }}>{memVecsStr}</div>
          <canvas ref={spark3Ref} width={60} height={16} style={{ width: '100%', height: '16px' }} />
        </div>

        {/* Tile 4 */}
        <div style={{ background: 'rgba(4, 7, 13, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>Active Segments</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '4px 0' }}>{segCountStr}</div>
          <canvas ref={spark4Ref} width={60} height={16} style={{ width: '100%', height: '16px' }} />
        </div>
      </div>

      {/* Bottom Row: Dual Timeline Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Chart 1: Throughput */}
        <div style={{ background: 'rgba(4, 7, 13, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Throughput (vectors/s)</span>
            <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
              <span style={{ color: 'var(--color-emerald)' }}>&bull; Ingest</span>
              <span style={{ color: 'var(--color-cyan)' }}>&bull; Query</span>
            </div>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '110px' }}>
            <canvas ref={throughputChartRef} style={{ width: '100%', height: '110px', display: 'block' }} />
          </div>
        </div>

        {/* Chart 2: Latency */}
        <div style={{ background: 'rgba(4, 7, 13, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Latency (ms)</span>
            <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
              <span style={{ color: 'var(--color-cyan)' }}>&bull; P50</span>
              <span style={{ color: 'var(--color-purple)' }}>&bull; P95</span>
              <span style={{ color: 'var(--color-amber)' }}>&bull; P99</span>
            </div>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '110px' }}>
            <canvas ref={latencyChartRef} style={{ width: '100%', height: '110px', display: 'block' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
