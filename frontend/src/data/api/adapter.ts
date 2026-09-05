import { EngineStats } from '../../types/telemetry';
import { DataState, MetricValue } from '../../types/dataState';

export interface NormalizedTelemetry {
  writeRate: MetricValue<number>;
  p99Latency: MetricValue<number>;
  activeMemtable: MetricValue<number>;
  immutableSegments: MetricValue<number>;
  durability: MetricValue<number>;
  memtableFillPct: number;
  walSizeBytes: number;
  totalWrites: number;
  isOnline: boolean;
  telemetryState: DataState;
  staleSeconds: number;
}

export function normalizeTelemetry(
  stats: EngineStats | null,
  isOnline: boolean,
  telemetryState: DataState,
  staleSec: number = 0
): NormalizedTelemetry {
  if (!isOnline || !stats) {
    return {
      writeRate: {
        value: null,
        state: telemetryState,
        target: '> 50,000 vec/s',
        sourceLabel: telemetryState === 'STALE' ? `STALE (${staleSec}s)` : 'AWAITING TELEMETRY',
      },
      p99Latency: {
        value: null,
        state: telemetryState,
        target: '< 15.0 ms',
        sourceLabel: telemetryState === 'STALE' ? `STALE (${staleSec}s)` : 'AWAITING TELEMETRY',
      },
      activeMemtable: {
        value: null,
        state: telemetryState,
        target: '5,000 threshold',
        sourceLabel: 'LOCK-FREE SIMD',
      },
      immutableSegments: {
        value: null,
        state: telemetryState,
        target: 'Immutable VSEG',
        sourceLabel: 'MMAP HNSW',
      },
      durability: {
        value: 100,
        state: 'CONFIGURED',
        target: 'Zero Data Loss',
        sourceLabel: 'CRC32 WAL (INV-01)',
      },
      memtableFillPct: 0,
      walSizeBytes: 0,
      totalWrites: 0,
      isOnline,
      telemetryState,
      staleSeconds: staleSec,
    };
  }

  const threshold = stats.memtable_threshold || 5000;
  const fillPct = stats.memtable_fill_pct ?? ((stats.active_memtable_vectors / threshold) * 100);

  return {
    writeRate: {
      value: stats.write_qps,
      state: telemetryState,
      target: '> 50,000 vec/s',
      sourceLabel: telemetryState === 'LIVE' ? 'LIVE (10Hz)' : `STALE (${staleSec}s)`,
    },
    p99Latency: {
      value: stats.p99_latency_ms,
      state: telemetryState,
      target: '< 15.0 ms',
      sourceLabel: telemetryState === 'LIVE' ? 'LIVE (10Hz)' : `STALE (${staleSec}s)`,
    },
    activeMemtable: {
      value: stats.active_memtable_vectors,
      state: telemetryState,
      target: `${threshold.toLocaleString()} threshold`,
      sourceLabel: 'LOCK-FREE SIMD',
    },
    immutableSegments: {
      value: stats.segment_count,
      state: telemetryState,
      target: 'Immutable VSEG',
      sourceLabel: 'MMAP HNSW',
    },
    durability: {
      value: 100,
      state: 'CONFIGURED',
      target: 'Zero Data Loss',
      sourceLabel: 'CRC32 WAL (INV-01)',
    },
    memtableFillPct: Math.min(Math.max(fillPct, 0), 100),
    walSizeBytes: stats.wal_size_bytes || 0,
    totalWrites: stats.total_writes || 0,
    isOnline: true,
    telemetryState,
    staleSeconds: staleSec,
  };
}
