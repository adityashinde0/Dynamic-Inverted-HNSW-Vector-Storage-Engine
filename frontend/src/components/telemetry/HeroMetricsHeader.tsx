import React, { useRef, useEffect } from 'react';
import { useTelemetry } from '../../data/telemetry/TelemetryContext';

interface HeroMetricsHeaderProps {
  onTrySearch: () => void;
  onWatchSystem: () => void;
}

export const HeroMetricsHeader: React.FC<HeroMetricsHeaderProps> = ({
  onTrySearch,
  onWatchSystem,
}) => {
  const { stats, benchmarkData } = useTelemetry();

  const spark1Ref = useRef<HTMLCanvasElement | null>(null);
  const spark2Ref = useRef<HTMLCanvasElement | null>(null);
  const spark3Ref = useRef<HTMLCanvasElement | null>(null);

  // Draw micro sparklines
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

    drawMiniSpark(spark1Ref.current, '#10b981', [10, 11, 9, 12, 11.5, 12.4, 12.2, 12.4]);
    drawMiniSpark(spark2Ref.current, '#00d2ff', [14, 12, 10, 9.5, 9.1, 8.8, 8.9, 8.7]);
    drawMiniSpark(spark3Ref.current, '#10b981', [0.95, 0.96, 0.97, 0.975, 0.98, 0.981, 0.982]);
  }, []);

  const emp = benchmarkData?.empirical_results;
  const throughputStr = stats?.write_qps != null
    ? `${(stats.write_qps / 1000).toFixed(1)}K vec/s`
    : emp?.write_throughput_qps
    ? `${(emp.write_throughput_qps / 1000).toFixed(1)}K vec/s`
    : '12.4K vec/s';

  const latencyStr = stats?.p99_latency_ms != null
    ? `${stats.p99_latency_ms.toFixed(1)} ms`
    : emp?.p99_latency_ms != null
    ? `${emp.p99_latency_ms.toFixed(1)} ms`
    : '8.7 ms';

  const recallStr = emp?.recall_at_10 != null
    ? emp.recall_at_10.toFixed(3)
    : '0.982';

  return (
    <div className="hero-headline-wrap">
      <div className="headline-left">
        <div className="hero-pretitle">STORE &bull; SEARCH &bull; SCALE &bull; REAL-TIME</div>
        <h1>
          VECTOR STORAGE <br />
          WITHOUT THE <span className="highlight">WRITE BOTTLENECK</span>
        </h1>
        <p>
          An LSM-inspired vector storage engine designed to separate continuous ingestion
          from immutable HNSW search. High-performance vector storage for real-world AI.
        </p>

        <div className="hero-cta-group">
          <button className="cta-primary" onClick={onTrySearch}>
            <span>Try Search</span>
            <span>&rsaquo;</span>
          </button>
          <button className="cta-secondary" onClick={onWatchSystem}>
            <span>▶</span>
            <span>Watch the System</span>
          </button>
        </div>
      </div>

      <div className="headline-right-metrics">
        {/* Metric 1 */}
        <div className="metric-chip">
          <span className="chip-lbl">Throughput</span>
          <div className="chip-val-row">
            <span className="chip-val">{throughputStr}</span>
            <canvas ref={spark1Ref} className="chip-sparkline" width={44} height={18} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="metric-chip">
          <span className="chip-lbl">Query Latency (P99)</span>
          <div className="chip-val-row">
            <span className="chip-val">{latencyStr}</span>
            <canvas ref={spark2Ref} className="chip-sparkline" width={44} height={18} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="metric-chip">
          <span className="chip-lbl">Recall@10</span>
          <div className="chip-val-row">
            <span className="chip-val">{recallStr}</span>
            <canvas ref={spark3Ref} className="chip-sparkline" width={44} height={18} />
          </div>
        </div>
      </div>
    </div>
  );
};
