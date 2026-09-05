import React, { useState } from 'react';
import { TelemetryProvider, useTelemetry } from '../data/telemetry/TelemetryContext';
import { TopNav } from '../components/navigation/TopNav';
import { EngineScene, PerspectiveMode } from '../visualization/three/EngineScene';
import { ParticleFlow } from '../visualization/canvas/ParticleFlow';
import { TelemetryStrip } from '../components/telemetry/TelemetryStrip';
import { KnnQueryPlayground } from '../components/search/KnnQueryPlayground';
import { SegmentTable } from '../components/segments/SegmentTable';
import { BenchmarkSection } from '../components/benchmark/BenchmarkSection';
import { CrashRecoverySection } from '../components/recovery/CrashRecoverySection';
import { TerminalLogs } from '../components/terminal/TerminalLogs';
import { NodeInspectorDrawer } from '../components/system/NodeInspectorDrawer';
import { JudgeModeModal } from '../components/judge/JudgeModeModal';

const CinematicLandingContent: React.FC = () => {
  const { telemetryState, normalized } = useTelemetry();

  const [perspective, setPerspective] = useState<PerspectiveMode>('overview');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isJudgeOpen, setIsJudgeOpen] = useState(false);

  const perspectives: { id: PerspectiveMode; label: string }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'writePath', label: 'WRITE PATH' },
    { id: 'queryPath', label: 'QUERY PATH' },
    { id: 'hnsw', label: 'HNSW GRAPH' },
  ];

  const handleNavigate = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleWatchEngine = () => {
    const modes: PerspectiveMode[] = ['overview', 'writePath', 'queryPath', 'hnsw'];
    const currentIdx = modes.indexOf(perspective);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    setPerspective(nextMode);
  };

  return (
    <div className="cinematic-shell">
      {/* 1. Minimal Top Navigation Bar (No heavy dashboard sidebar) */}
      <TopNav
        onOpenJudge={() => setIsJudgeOpen(true)}
        onNavigate={handleNavigate}
      />

      {/* 2. Hero Section: Product Launch Atmosphere */}
      <section id="hero-top" className="cinematic-hero-section">
        <div className="hero-eyebrow">
          <span>STORE &bull; SEARCH &bull; SCALE &bull; REAL-TIME</span>
        </div>

        <h1 className="hero-title-giant">
          VECTOR STORAGE <br />
          WITHOUT THE <span className="accent-gradient">WRITE BOTTLENECK</span>
        </h1>

        <p className="hero-subtitle">
          An LSM-inspired vector storage engine designed to separate continuous ingestion
          from immutable HNSW search. Built for streaming real-world AI workloads.
        </p>

        <div className="hero-actions-row">
          <button className="btn-hero-primary" onClick={() => handleNavigate('search-section')}>
            <span>TRY SEARCH</span>
            <span>&rsaquo;</span>
          </button>
          <button className="btn-hero-secondary" onClick={handleWatchEngine}>
            <span>▶</span>
            <span>WATCH ENGINE</span>
          </button>
        </div>
      </section>

      {/* 3. Immersive 3D Engine Stage (Visually emerges from the page, not trapped in a card) */}
      <div className="immersive-3d-stage">
        <EngineScene
          perspective={perspective}
          onNodeSelect={(node) => setSelectedNode(node)}
          fillPct={normalized.memtableFillPct}
        />
        <ParticleFlow isTelemetryLive={telemetryState === 'LIVE'} />

        {/* Discreet Perspective Selector */}
        <div className="stage-perspective-bar">
          {perspectives.map((p) => (
            <button
              key={p.id}
              className={`perspective-pill ${perspective === p.id ? 'active' : ''}`}
              onClick={() => setPerspective(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Refined Horizontal Telemetry Strip */}
      <TelemetryStrip />

      {/* 5. Flowing Technical Content Sections */}
      <main className="product-content-wrap">
        {/* Section 1: Concurrent Search Playground */}
        <section id="search-section" className="content-section">
          <div className="section-eyebrow-row">
            <div className="section-headline-group">
              <span className="section-badge-num">01</span>
              <h2>REAL-TIME CONCURRENT VECTOR SEARCH</h2>
            </div>
            <span className="section-badge-tag">RAYON PARALLEL FAN-OUT &bull; TOP-K MERGE</span>
          </div>
          <KnnQueryPlayground />
        </section>

        {/* Section 2: Immutable Segment Repository */}
        <section id="segments-section" className="content-section">
          <div className="section-eyebrow-row">
            <div className="section-headline-group">
              <span className="section-badge-num">02</span>
              <h2>IMMUTABLE DISK SEGMENT REPOSITORY (VSEG)</h2>
            </div>
            <span className="section-badge-tag">SQ8 QUANTIZATION &bull; MMAP ZERO-COPY</span>
          </div>
          <SegmentTable />
        </section>

        {/* Section 3: Benchmark SLA Invariant Audit */}
        <section id="benchmark-section" className="content-section">
          <div className="section-eyebrow-row">
            <div className="section-headline-group">
              <span className="section-badge-num">03</span>
              <h2>BENCHMARK SLA INVARIANT AUDIT</h2>
            </div>
            <span className="section-badge-tag">TARGET SPECIFICATIONS VS EMPIRICAL EVIDENCE</span>
          </div>
          <BenchmarkSection />
        </section>

        {/* Section 4: Crash Recovery & Durability */}
        <section id="recovery-section" className="content-section">
          <div className="section-eyebrow-row">
            <div className="section-headline-group">
              <span className="section-badge-num">04</span>
              <h2>CRASH RECOVERY &amp; DURABILITY (INV-10)</h2>
            </div>
            <span className="section-badge-tag">WAL SEQUENTIAL REPLAY &bull; ZERO DATA LOSS</span>
          </div>
          <CrashRecoverySection />
        </section>

        {/* Section 5: System Event Stream */}
        <section className="content-section">
          <div className="section-eyebrow-row">
            <div className="section-headline-group">
              <span className="section-badge-num">05</span>
              <h2>CONTROL ROOM EVENT LOG STREAM</h2>
            </div>
            <span className="section-badge-tag">10Hz REAL-TIME EVENT TRACE</span>
          </div>
          <TerminalLogs />
        </section>
      </main>

      {/* Global Minimal Footer */}
      <footer className="cinematic-footer">
        <div>PS-005 &bull; High-Performance Vector Storage Engine</div>
        <div className="footer-links">
          <span onClick={() => setIsJudgeOpen(true)}>Judge Mode Audit</span>
          <span onClick={() => handleNavigate('benchmark-section')}>Benchmarks</span>
          <span onClick={() => handleNavigate('recovery-section')}>Crash Recovery</span>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </footer>

      {/* Subsystem Invariant Inspector Drawer */}
      <NodeInspectorDrawer
        nodeKey={selectedNode}
        onClose={() => setSelectedNode(null)}
      />

      {/* Judge Mode Modal */}
      <JudgeModeModal
        isOpen={isJudgeOpen}
        onClose={() => setIsJudgeOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <TelemetryProvider>
      <CinematicLandingContent />
    </TelemetryProvider>
  );
};
