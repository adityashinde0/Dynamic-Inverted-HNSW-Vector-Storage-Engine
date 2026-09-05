/**
 * pipeline-diagram.js
 * -------------------------------------------------------------
 * Hand-drawn-schematic style canvas animation of the PS-005
 * write/read path:
 *
 *   client -> WAL -> MemTable -> (flush) -> Segment(s) -> merge
 *                        \-----------\-----------/
 *                         \    Query Router (gRPC) fans out
 *                          \   to MemTable + every segment,
 *                           \  merges candidates into top-k
 *
 * Pure canvas 2D, no dependencies. Respects prefers-reduced-motion
 * by freezing on a representative static frame.
 * -------------------------------------------------------------
 */
export function initPipelineDiagram(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H;

  const colors = {
    line: '#333a48',
    lineStrong: '#4a5468',
    paper: '#e9e5d8',
    paperDim: '#a9a495',
    brass: '#c08a4e',
    slate: '#6a8caa',
    rust: '#ad4d34',
    panel: '#181c25'
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- layout: normalized coordinates (0..1) scaled to W/H ----
  const nodes = {
    client:   { x: 0.06, y: 0.5,  label: 'client write' },
    wal:      { x: 0.24, y: 0.24, label: 'WAL', sub: 'durable log' },
    memtable: { x: 0.24, y: 0.62, label: 'MemTable', sub: 'in-memory, sorted' },
    seg1:     { x: 0.52, y: 0.5,  label: 'segment', sub: 'quantized + HNSW' },
    seg2:     { x: 0.52, y: 0.78, label: 'segment' },
    seg3:     { x: 0.52, y: 0.92, label: 'segment' },
    merge:    { x: 0.72, y: 0.7,  label: 'compaction', sub: 'background merge' },
    router:   { x: 0.88, y: 0.3,  label: 'query router', sub: 'Go / gRPC' },
    topk:     { x: 1.0,  y: 0.3,  label: 'top-k' },
  };

  function P(n) { return { x: n.x * W, y: n.y * H }; }

  // moving particles along paths: {from,to,progress,speed,color,kind}
  let particles = [];
  let spawnClock = 0;
  let queryClock = 0;

  function spawnWrite() {
    particles.push({ path: ['client', 'wal'], t: 0, speed: 0.9 + Math.random() * 0.3, color: colors.brass, kind: 'write' });
  }
  function spawnFlush() {
    particles.push({ path: ['memtable', 'seg1'], t: 0, speed: 0.55, color: colors.brass, kind: 'flush' });
  }
  function spawnQuery() {
    ['memtable', 'seg1', 'seg2', 'seg3'].forEach((target, i) => {
      particles.push({ path: ['router', target], t: 0, speed: 0.7 + i * 0.05, color: colors.slate, kind: 'fanout', reverse: true, delay: i * 0.08 });
    });
  }

  function pathPoint(a, b, t) {
    const pa = P(a), pb = P(b);
    // slight curve via quadratic control point offset from the midline
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const nx = -dy, ny = dx;
    const norm = Math.hypot(nx, ny) || 1;
    const bend = 0.06 * norm;
    const cx = mx + (nx / norm) * bend * 0;
    const cy = my + (ny / norm) * bend * 0;
    const x = (1 - t) * (1 - t) * pa.x + 2 * (1 - t) * t * cx + t * t * pb.x;
    const y = (1 - t) * (1 - t) * pa.y + 2 * (1 - t) * t * cy + t * t * pb.y;
    return { x, y };
  }

  function drawNode(n, opts = {}) {
    const p = P(n);
    const w = opts.w || 92, h = opts.h || 44;
    ctx.save();
    ctx.strokeStyle = opts.active ? colors.brass : colors.lineStrong;
    ctx.lineWidth = 1;
    ctx.fillStyle = colors.panel;
    ctx.beginPath();
    ctx.rect(p.x - w / 2, p.y - h / 2, w, h);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = colors.paper;
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, p.x, p.y - (n.sub ? 6 : 0));
    if (n.sub) {
      ctx.fillStyle = colors.paperDim;
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(n.sub, p.x, p.y + 10);
    }
    ctx.restore();
  }

  function drawEdge(a, b, color = colors.line) {
    const pa = P(a), pb = P(b);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.restore();
  }

  function frame(dt) {
    ctx.clearRect(0, 0, W, H);

    // static edges (structure of the system)
    drawEdge(nodes.client, nodes.wal);
    drawEdge(nodes.client, nodes.memtable);
    drawEdge(nodes.memtable, nodes.seg1, colors.line);
    drawEdge(nodes.seg1, nodes.merge);
    drawEdge(nodes.seg2, nodes.merge);
    drawEdge(nodes.seg3, nodes.merge);
    drawEdge(nodes.router, nodes.memtable, colors.slate);
    drawEdge(nodes.router, nodes.seg1, colors.slate);
    drawEdge(nodes.router, nodes.seg2, colors.slate);
    drawEdge(nodes.router, nodes.seg3, colors.slate);
    drawEdge(nodes.router, nodes.topk, colors.slate);

    // nodes
    drawNode(nodes.client, { w: 96 });
    drawNode(nodes.wal);
    drawNode(nodes.memtable, { w: 104 });
    drawNode(nodes.seg1, { w: 104 });
    drawNode(nodes.seg2, { w: 84, h: 34 });
    drawNode(nodes.seg3, { w: 84, h: 34 });
    drawNode(nodes.merge, { w: 104 });
    drawNode(nodes.router, { w: 108 });
    drawNode(nodes.topk, { w: 64 });

    // particles
    particles.forEach(pt => {
      if (pt.delay && pt.delay > 0) { pt.delay -= dt; return; }
      pt.t += dt * pt.speed;
      const a = nodes[pt.path[0]], b = nodes[pt.path[1]];
      const t = pt.reverse ? pt.t : pt.t;
      const pos = pathPoint(a, b, Math.min(t, 1));
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    particles = particles.filter(p => p.t < 1.05);
  }

  if (reduceMotion) {
    // static representative frame, no animation loop
    frame(0);
    spawnFlush();
    spawnQuery();
    frame(0.4);
    return { destroy() { window.removeEventListener('resize', resize); } };
  }

  let raf;
  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    spawnClock += dt;
    queryClock += dt;
    if (spawnClock > 0.6) { spawnClock = 0; spawnWrite(); }
    if (Math.random() < dt * 0.4) spawnFlush();
    if (queryClock > 2.2) { queryClock = 0; spawnQuery(); }
    frame(dt);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    }
  };
}
