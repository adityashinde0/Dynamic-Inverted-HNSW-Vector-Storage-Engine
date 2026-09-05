import React, { useEffect, useRef } from 'react';

interface SparklineProps {
  type: 'latency' | 'throughput';
  data: any[];
}

export const Sparkline: React.FC<SparklineProps> = ({ type, data }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#141a26';
    ctx.lineWidth = 1;
    for (let y = 0.25; y < 1.0; y += 0.25) {
      ctx.beginPath();
      ctx.moveTo(0, h * y);
      ctx.lineTo(w, h * y);
      ctx.stroke();
    }

    if (type === 'latency') {
      const maxY = 20.0;
      // 15ms SLA Target Line
      const targetY = h - (15.0 / maxY) * (h - 20) - 10;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText('15.0 ms SLA TARGET', w - 110, targetY - 4);

      if (data.length < 2) {
        ctx.fillStyle = '#455266';
        ctx.font = '11px Outfit, sans-serif';
        ctx.fillText('Collecting latency telemetry...', 16, h / 2);
        return;
      }

      const step = w / 39;
      const offset = (40 - data.length) * step;

      // P99 line (emerald)
      drawLine(ctx, data.map((d) => d.p99), maxY, h, offset, step, '#10b981', 2);
      // P95 line (amber)
      drawLine(ctx, data.map((d) => d.p95), maxY, h, offset, step, '#f59e0b', 1.5);
      // P50 line (slate)
      drawLine(ctx, data.map((d) => d.p50), maxY, h, offset, step, '#8291a5', 1.5);
    } else {
      let maxVal = 1000;
      data.forEach((d) => {
        if (d.writeQps > maxVal) maxVal = d.writeQps;
        if (d.queryQps > maxVal) maxVal = d.queryQps;
      });
      maxVal = Math.ceil(maxVal * 1.25);

      if (data.length < 2) {
        ctx.fillStyle = '#455266';
        ctx.font = '11px Outfit, sans-serif';
        ctx.fillText('Collecting throughput telemetry...', 16, h / 2);
        return;
      }

      const step = w / 39;
      const offset = (40 - data.length) * step;

      // Write QPS (Cyan)
      drawLine(ctx, data.map((d) => d.writeQps), maxVal, h, offset, step, '#00d2ff', 2);
      // Query QPS (Purple)
      drawLine(ctx, data.map((d) => d.queryQps), maxVal, h, offset, step, '#a855f7', 2);
    }
  }, [type, data]);

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    values: number[],
    maxY: number,
    h: number,
    offset: number,
    step: number,
    color: string,
    width: number
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = offset + i * step;
      const normalized = Math.min(v / maxY, 1.0);
      const y = h - 10 - normalized * (h - 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  return <canvas ref={canvasRef} style={{ width: '100%', height: '140px' }} />;
};
