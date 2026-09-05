/**
 * PS-005 Vector Storage Engine — 2D Canvas Data Pulse & Flow Tracer
 *
 * Implements high-frequency visual data flow:
 * 1. Stream 1: Ingestion Vector Stream (Cyan) [Ingest -> WAL -> MemTable -> Rotation -> Segment]
 * 2. Stream 2: Concurrent Search Stream (Emerald) [Router -> Parallel Fan-out -> Top-K Dedup]
 *
 * Section 11 & 15:
 * - With live data: Real event-driven motion.
 * - Without live data / Telemetry unavailable: Calm static architecture state.
 * - NEVER generate fake activity when data is missing.
 */

class FlowCanvasVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.animId = null;
    this.isDisposed = false;
    this.isLive = false;

    // Particle Pools
    this.writeParticles = [];
    this.queryParticles = [];
    this.maxParticles = 60;

    // Fixed Architectural Flow Waypoints (Normalized 0.0 to 1.0)
    this.writePath = [
      { x: 0.12, y: 0.76 }, // Ingest
      { x: 0.28, y: 0.76 }, // WAL
      { x: 0.46, y: 0.76 }, // Active MemTable
      { x: 0.64, y: 0.76 }, // Immutable Queue
      { x: 0.82, y: 0.76 }  // Disk Segment
    ];

    this.queryPath = [
      { x: 0.18, y: 0.26 }, // Search Router
      { x: 0.44, y: 0.26 }, // Parallel Fan-out
      { x: 0.68, y: 0.26 }, // HNSW Traversal
      { x: 0.86, y: 0.26 }  // Top-K Deduplicator
    ];

    this.init();
  }

  init() {
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.animate();
  }

  handleResize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height || 260) * dpr;
    if (this.ctx) this.ctx.scale(dpr, dpr);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height || 260;
  }

  setTelemetryLive(isLive) {
    this.isLive = isLive;
    if (!isLive) {
      // Clear active streaming particles in offline mode (Calm Static Architecture)
      this.writeParticles = [];
      this.queryParticles = [];
    }
  }

  triggerIngestBurst(count = 12) {
    if (this.isDisposed) return;
    for (let i = 0; i < Math.min(count, 20); i++) {
      this.writeParticles.push({
        progress: -(i * 0.04),
        speed: 0.008 + Math.random() * 0.004,
        size: 3 + Math.random() * 2,
        color: '#00d2ff'
      });
    }
  }

  triggerQueryBurst(count = 10) {
    if (this.isDisposed) return;
    for (let i = 0; i < Math.min(count, 16); i++) {
      this.queryParticles.push({
        progress: -(i * 0.05),
        speed: 0.012 + Math.random() * 0.005,
        size: 3.5 + Math.random() * 2,
        color: '#10b981'
      });
    }
  }

  animate() {
    if (this.isDisposed) return;
    this.animId = requestAnimationFrame(() => this.animate());

    const w = this.displayWidth;
    const h = this.displayHeight;
    const ctx = this.ctx;
    if (!ctx || !w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Architectural Static Backbone Guides
    this.drawStaticBackbone(ctx, w, h);

    // 2. If telemetry is LIVE or queries are active, render real particle pulses
    if (this.isLive || this.writeParticles.length > 0 || this.queryParticles.length > 0) {
      this.renderParticleStream(ctx, w, h, this.writeParticles, this.writePath, '#00d2ff');
      this.renderParticleStream(ctx, w, h, this.queryParticles, this.queryPath, '#10b981');
    }
  }

  drawStaticBackbone(ctx, w, h) {
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);

    // Query Stream Backbone (Top)
    ctx.strokeStyle = this.isLive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(100, 116, 139, 0.15)';
    ctx.beginPath();
    this.queryPath.forEach((pt, idx) => {
      const x = pt.x * w;
      const y = pt.y * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Write Stream Backbone (Bottom)
    ctx.strokeStyle = this.isLive ? 'rgba(0, 210, 255, 0.25)' : 'rgba(100, 116, 139, 0.15)';
    ctx.beginPath();
    this.writePath.forEach((pt, idx) => {
      const x = pt.x * w;
      const y = pt.y * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.setLineDash([]);
  }

  renderParticleStream(ctx, w, h, particles, path, defaultColor) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.progress += p.speed;

      if (p.progress >= 1.0) {
        particles.splice(i, 1);
        continue;
      }

      if (p.progress < 0) continue;

      // Interpolate along waypoints
      const totalSegments = path.length - 1;
      const segProgress = p.progress * totalSegments;
      const currentSeg = Math.floor(segProgress);
      const segT = segProgress - currentSeg;

      const p1 = path[currentSeg];
      const p2 = path[Math.min(currentSeg + 1, totalSegments)];

      const x = (p1.x + (p2.x - p1.x) * segT) * w;
      const y = (p1.y + (p2.y - p1.y) * segT) * h;

      // Glow effect
      ctx.fillStyle = p.color || defaultColor;
      ctx.shadowColor = p.color || defaultColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.animId) cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', () => this.handleResize());
  }
}

window.FlowCanvasVisualizer = FlowCanvasVisualizer;
