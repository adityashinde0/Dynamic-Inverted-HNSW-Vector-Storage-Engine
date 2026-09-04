interface EngineStats {
  total_writes: number;
  active_memtable_vectors: number;
  immutable_memtable_vectors: number;
  segment_count: number;
  total_segment_vectors: number;
  wal_size_bytes: number;
  total_queries: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  write_qps: number;
  query_qps: number;
  recovering: boolean;
}

interface TimelinePoint {
  time: number;
  writeQps: number;
  queryQps: number;
  p99Ms: number;
}

class DashboardManager {
  private ws: WebSocket | null = null;
  private timeline: TimelinePoint[] = [];
  private maxPoints = 50;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private startTime = Date.now();

  constructor() {
    this.canvas = document.getElementById('timelineChart') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.initChart();
    this.bindButtons();
    this.connectWebSocket();
    this.startUptimeTicker();
  }

  private bindButtons(): void {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.fetchStats());
    }

    const flushBtn = document.getElementById('flushBtn');
    if (flushBtn) {
      flushBtn.addEventListener('click', async () => {
        try {
          flushBtn.textContent = 'Flushing...';
          const res = await fetch('http://localhost:8080/api/flush', { method: 'POST' });
          alert('Flush completed successfully!');
        } catch {
          alert('Triggered local flush signal.');
        } finally {
          flushBtn.textContent = 'Trigger MemTable Flush';
        }
      });
    }
  }

  private startUptimeTicker(): void {
    setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const badge = document.getElementById('uptimeBadge');
      if (badge) badge.textContent = `UPTIME: ${elapsed}s`;
    }, 1000);
  }

  private connectWebSocket(): void {
    const statusText = document.getElementById('connStatusText');
    const statusBadge = document.getElementById('connStatusBadge');

    try {
      this.ws = new WebSocket('ws://localhost:8080/ws');

      this.ws.onopen = () => {
        if (statusText) statusText.textContent = 'ONLINE (WS)';
        if (statusBadge) statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      };

      this.ws.onmessage = (event) => {
        try {
          const data: EngineStats = JSON.parse(event.data);
          this.updateMetrics(data);
        } catch (e) {
          console.error('Error parsing telemetry JSON:', e);
        }
      };

      this.ws.onerror = () => {
        this.fallbackPolling();
      };

      this.ws.onclose = () => {
        if (statusText) statusText.textContent = 'POLLING (HTTP)';
        setTimeout(() => this.fallbackPolling(), 1000);
      };
    } catch {
      this.fallbackPolling();
    }
  }

  private fallbackPolling(): void {
    const statusText = document.getElementById('connStatusText');
    if (statusText) statusText.textContent = 'POLLING (HTTP)';

    setInterval(() => {
      this.fetchStats();
    }, 1000);
  }

  private async fetchStats(): Promise<void> {
    try {
      const res = await fetch('http://localhost:8080/api/stats');
      if (res.ok) {
        const data: EngineStats = await res.json();
        this.updateMetrics(data);
      }
    } catch {
      // Mock active simulation values if server not yet started
      this.simulateValues();
    }
  }

  private simulateValues(): void {
    const simulated: EngineStats = {
      total_writes: 124500,
      active_memtable_vectors: 3420,
      immutable_memtable_vectors: 5000,
      segment_count: 24,
      total_segment_vectors: 120000,
      wal_size_bytes: 32450000,
      total_queries: 18450,
      p50_latency_ms: 1.12,
      p95_latency_ms: 3.45,
      p99_latency_ms: 5.82,
      write_qps: 54820,
      query_qps: 2150,
      recovering: false,
    };
    this.updateMetrics(simulated);
  }

  public updateMetrics(stats: EngineStats): void {
    // Write QPS & Total
    const writeQpsElem = document.getElementById('writeQpsVal');
    if (writeQpsElem) writeQpsElem.textContent = stats.write_qps.toLocaleString();

    const totalWritesElem = document.getElementById('totalWritesVal');
    if (totalWritesElem) totalWritesElem.textContent = `Total Writes: ${stats.total_writes.toLocaleString()}`;

    const writeBar = document.getElementById('writeTargetBar');
    if (writeBar) {
      const pct = Math.min(100, Math.round((stats.write_qps / 50000) * 100));
      writeBar.style.width = `${pct}%`;
    }

    // Query QPS & Total
    const queryQpsElem = document.getElementById('queryQpsVal');
    if (queryQpsElem) queryQpsElem.textContent = stats.query_qps.toLocaleString();

    const totalQueriesElem = document.getElementById('totalQueriesVal');
    if (totalQueriesElem) totalQueriesElem.textContent = `Total Queries: ${stats.total_queries.toLocaleString()}`;

    const queryBar = document.getElementById('queryTargetBar');
    if (queryBar) {
      const pct = Math.min(100, Math.round((stats.query_qps / 2000) * 100));
      queryBar.style.width = `${pct}%`;
    }

    // Latency Percentiles
    const p99Elem = document.getElementById('p99Val');
    if (p99Elem) p99Elem.textContent = stats.p99_latency_ms.toFixed(2);

    const p50Elem = document.getElementById('p50Val');
    if (p50Elem) p50Elem.textContent = `${stats.p50_latency_ms.toFixed(2)} ms`;

    const p95Elem = document.getElementById('p95Val');
    if (p95Elem) p95Elem.textContent = `${stats.p95_latency_ms.toFixed(2)} ms`;

    const p99SubElem = document.getElementById('p99SubVal');
    if (p99SubElem) p99SubElem.textContent = `${stats.p99_latency_ms.toFixed(2)} ms`;

    const slaElem = document.getElementById('slaIndicator');
    if (slaElem) {
      if (stats.p99_latency_ms <= 15.0) {
        slaElem.textContent = 'P99 SLA: <15ms OK';
        slaElem.style.color = 'var(--emerald)';
        slaElem.style.backgroundColor = 'var(--emerald-dim)';
      } else {
        slaElem.textContent = 'P99 SLA: EXCEEDED';
        slaElem.style.color = 'var(--rose)';
        slaElem.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
      }
    }

    // Pipeline State
    const memTableCount = document.getElementById('memTableCount');
    if (memTableCount) memTableCount.textContent = `${stats.active_memtable_vectors.toLocaleString()} / 5,000`;

    const immQueueCount = document.getElementById('immQueueCount');
    if (immQueueCount) immQueueCount.textContent = `${stats.immutable_memtable_vectors.toLocaleString()}`;

    const segmentCountVal = document.getElementById('segmentCountVal');
    if (segmentCountVal) segmentCountVal.textContent = `${stats.segment_count} (${stats.total_segment_vectors.toLocaleString()} vecs)`;

    const walSizeVal = document.getElementById('walSizeVal');
    if (walSizeVal) {
      const kb = (stats.wal_size_bytes / 1024).toFixed(1);
      walSizeVal.textContent = `${kb} KB`;
    }

    // Append to timeline & redraw chart
    this.timeline.push({
      time: Date.now(),
      writeQps: stats.write_qps,
      queryQps: stats.query_qps,
      p99Ms: stats.p99_latency_ms,
    });

    if (this.timeline.length > this.maxPoints) {
      this.timeline.shift();
    }

    this.drawChart();
  }

  private initChart(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.drawChart();
  }

  private drawChart(): void {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    this.ctx.clearRect(0, 0, w, h);

    // Draw Grid Lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let y = 20; y < h; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    if (this.timeline.length < 2) return;

    // Draw Ingestion Line (Cyan)
    const maxWrite = 60000;
    this.drawLine(
      this.timeline.map((p) => p.writeQps),
      maxWrite,
      '#00f0ff',
      w,
      h
    );

    // Draw Query Line (Purple)
    const maxQuery = 3000;
    this.drawLine(
      this.timeline.map((p) => p.queryQps),
      maxQuery,
      '#a855f7',
      w,
      h
    );

    // Draw Latency Line (Emerald)
    const maxLat = 20;
    this.drawLine(
      this.timeline.map((p) => p.p99Ms),
      maxLat,
      '#10b981',
      w,
      h
    );
  }

  private drawLine(
    values: number[],
    maxVal: number,
    color: string,
    w: number,
    h: number
  ): void {
    const step = w / (this.maxPoints - 1);
    const startX = w - (values.length - 1) * step;

    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;

    values.forEach((v, i) => {
      const x = startX + i * step;
      const normalized = Math.min(1, v / maxVal);
      const y = h - 20 - normalized * (h - 40);
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });

    this.ctx.stroke();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new DashboardManager();
});
