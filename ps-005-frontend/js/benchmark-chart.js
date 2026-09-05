/**
 * benchmark-chart.js
 * -------------------------------------------------------------
 * Small canvas bar chart for query latency percentiles under
 * concurrent write load. Deliberately plain — a data plate,
 * not a decorative graphic.
 * -------------------------------------------------------------
 */
export function initBenchmarkChart(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const data = [
    { label: 'p50', ms: 1.8 },
    { label: 'p90', ms: 4.1 },
    { label: 'p99', ms: 9.6 },
    { label: 'p99.9', ms: 21.4 },
  ];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(rect.width, rect.height);
  }

  function draw(W, H) {
    ctx.clearRect(0, 0, W, H);
    const padLeft = 46, padBottom = 28, padTop = 16, padRight = 16;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    const max = Math.max(...data.map(d => d.ms)) * 1.15;

    // axis
    ctx.strokeStyle = '#333a48';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.lineTo(padLeft + chartW, padTop + chartH);
    ctx.stroke();

    // gridlines + y labels
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#6b6a63';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i;
      const y = padTop + chartH - (v / max) * chartH;
      ctx.strokeStyle = 'rgba(51,58,72,0.5)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(1), padLeft - 8, y);
    }

    // bars
    const barW = (chartW / data.length) * 0.42;
    data.forEach((d, i) => {
      const slot = chartW / data.length;
      const x = padLeft + slot * i + slot / 2 - barW / 2;
      const barH = (d.ms / max) * chartH;
      const y = padTop + chartH - barH;

      ctx.fillStyle = i === data.length - 1 ? '#ad4d34' : '#c08a4e';
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = '#e9e5d8';
      ctx.textAlign = 'center';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText(d.ms + 'ms', x + barW / 2, y - 10);

      ctx.fillStyle = '#a9a495';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(d.label, x + barW / 2, padTop + chartH + 16);
    });
  }

  resize();
  window.addEventListener('resize', resize);
  return { destroy() { window.removeEventListener('resize', resize); } };
}
