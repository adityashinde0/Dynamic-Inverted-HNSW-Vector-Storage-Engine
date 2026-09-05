import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { EngineStats, LatencyHistoryPoint, ThroughputHistoryPoint } from '../../types/telemetry';
import { DataState } from '../../types/dataState';
import { apiClient } from '../api/client';
import { normalizeTelemetry, NormalizedTelemetry } from '../api/adapter';
import { SegmentMeta } from '../../types/segments';
import { BenchmarkResponse } from '../../types/benchmark';

interface TelemetryContextValue {
  stats: EngineStats | null;
  normalized: NormalizedTelemetry;
  isOnline: boolean;
  telemetryState: DataState;
  staleSeconds: number;
  latencyHistory: LatencyHistoryPoint[];
  throughputHistory: ThroughputHistoryPoint[];
  segments: SegmentMeta[];
  benchmarkData: BenchmarkResponse | null;
  benchmarkState: DataState;
  isBenchmarking: boolean;
  logs: { id: string; time: string; level: 'SYSTEM' | 'INGEST' | 'QUERY' | 'BENCH' | 'WARN'; message: string }[];
  addLog: (level: 'SYSTEM' | 'INGEST' | 'QUERY' | 'BENCH' | 'WARN', message: string) => void;
  clearLogs: () => void;
  fetchBenchmark: () => Promise<void>;
  runBenchmarkWorkload: () => Promise<void>;
  fetchSegments: () => Promise<void>;
  ingestBatch: (count?: number) => Promise<void>;
  flushMemtable: () => Promise<void>;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [telemetryState, setTelemetryState] = useState<DataState>('UNAVAILABLE');
  const [staleSeconds, setStaleSeconds] = useState(0);
  const [segments, setSegments] = useState<SegmentMeta[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null);
  const [benchmarkState, setBenchmarkState] = useState<DataState>('UNAVAILABLE');
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [logs, setLogs] = useState<TelemetryContextValue['logs']>([]);

  const [latencyHistory, setLatencyHistory] = useState<LatencyHistoryPoint[]>([]);
  const [throughputHistory, setThroughputHistory] = useState<ThroughputHistoryPoint[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<any>(null);
  const lastUpdateRef = useRef<number>(0);
  const maxHistoryPoints = 40;

  const addLog = useCallback((level: 'SYSTEM' | 'INGEST' | 'QUERY' | 'BENCH' | 'WARN', message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-100), { id: Math.random().toString(36).slice(2), time, level, message }]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleTelemetryUpdate = useCallback((newStats: EngineStats) => {
    lastUpdateRef.current = Date.now();
    setStats(newStats);
    setIsOnline(true);
    setTelemetryState('LIVE');
    setStaleSeconds(0);

    const now = Date.now();
    setLatencyHistory((prev) => {
      const point: LatencyHistoryPoint = {
        p50: newStats.p50_latency_ms || 0,
        p95: newStats.p95_latency_ms || 0,
        p99: newStats.p99_latency_ms || 0,
        timestamp: now,
      };
      return [...prev.slice(-maxHistoryPoints + 1), point];
    });

    setThroughputHistory((prev) => {
      const point: ThroughputHistoryPoint = {
        writeQps: newStats.write_qps || 0,
        queryQps: newStats.query_qps || 0,
        timestamp: now,
      };
      return [...prev.slice(-maxHistoryPoints + 1), point];
    });
  }, []);

  // Poll fallback
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(async () => {
      try {
        const data = await apiClient.getStats();
        handleTelemetryUpdate(data);
      } catch {
        setIsOnline(false);
        setTelemetryState('UNAVAILABLE');
      }
    }, 1500);
  }, [handleTelemetryUpdate]);

  // WebSocket Connection
  const connectWs = useCallback(() => {
    try {
      const ws = new WebSocket(apiClient.getWsUrl() + '/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('SYSTEM', 'WebSocket telemetry stream connected at 10Hz.');
        setIsOnline(true);
        setTelemetryState('LIVE');
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: EngineStats = JSON.parse(event.data);
          handleTelemetryUpdate(data);
        } catch {
          // parse error
        }
      };

      ws.onclose = () => {
        setTelemetryState('STALE');
        startPolling();
        setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        setTelemetryState('ERROR');
      };
    } catch {
      startPolling();
    }
  }, [addLog, handleTelemetryUpdate, startPolling]);

  // Stale detection ticker
  useEffect(() => {
    const staleInterval = setInterval(() => {
      if (lastUpdateRef.current > 0) {
        const elapsedSec = Math.round((Date.now() - lastUpdateRef.current) / 1000);
        setStaleSeconds(elapsedSec);

        if (elapsedSec > 3) {
          if (elapsedSec <= 45) {
            setTelemetryState('STALE');
          } else {
            setTelemetryState('UNAVAILABLE');
          }
        }
      }
    }, 1000);
    return () => clearInterval(staleInterval);
  }, []);

  // Initialize
  useEffect(() => {
    connectWs();
    fetchSegments();
    fetchBenchmark();

    const segTimer = setInterval(fetchSegments, 3000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      clearInterval(segTimer);
    };
  }, [connectWs]);

  const fetchSegments = async () => {
    try {
      const segs = await apiClient.getSegments();
      setSegments(segs);
    } catch {
      // offline
    }
  };

  const fetchBenchmark = async () => {
    try {
      const bench = await apiClient.getBenchmark();
      setBenchmarkData(bench);
      setBenchmarkState('MEASURED');
    } catch {
      setBenchmarkState('UNAVAILABLE');
    }
  };

  const runBenchmarkWorkload = async () => {
    setIsBenchmarking(true);
    addLog('BENCH', 'Executing high-throughput batch ingestion benchmark workload...');
    try {
      for (let i = 0; i < 3; i++) {
        await apiClient.ingestBatch(1000);
        await new Promise((r) => setTimeout(r, 300));
      }
      addLog('BENCH', 'Workload completed. Fetching verified benchmark statistics...');
      await fetchBenchmark();
      await fetchSegments();
    } catch {
      addLog('WARN', 'Benchmark workload execution failed. Server unreachable.');
    } finally {
      setIsBenchmarking(false);
    }
  };

  const ingestBatch = async (count: number = 1000) => {
    try {
      addLog('INGEST', `Submitting batch ingestion of ${count} vectors...`);
      await apiClient.ingestBatch(count);
      addLog('INGEST', `Batch ingestion accepted into WAL & Active MemTable.`);
    } catch {
      addLog('WARN', `Ingestion failed: Backend storage engine unreachable.`);
    }
  };

  const flushMemtable = async () => {
    try {
      addLog('SYSTEM', 'Requesting atomic MemTable rotation & segment seal...');
      await apiClient.flushMemtable();
      addLog('SYSTEM', 'Active MemTable rotated to Immutable Queue. Segment published.');
      await fetchSegments();
    } catch {
      addLog('WARN', 'Flush failed: Backend storage engine unreachable.');
    }
  };

  const normalized = normalizeTelemetry(stats, isOnline, telemetryState, staleSeconds);

  return (
    <TelemetryContext.Provider
      value={{
        stats,
        normalized,
        isOnline,
        telemetryState,
        staleSeconds,
        latencyHistory,
        throughputHistory,
        segments,
        benchmarkData,
        benchmarkState,
        isBenchmarking,
        logs,
        addLog,
        clearLogs,
        fetchBenchmark,
        runBenchmarkWorkload,
        fetchSegments,
        ingestBatch,
        flushMemtable,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry must be used within a TelemetryProvider');
  return ctx;
};
