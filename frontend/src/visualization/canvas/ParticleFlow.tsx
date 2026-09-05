import React, { useEffect, useRef } from 'react';

interface ParticleFlowProps {
  isTelemetryLive: boolean;
}

interface Particle {
  x: number;
  y: number;
  speed: number;
  color: string;
  size: number;
  progress: number;
  type: 'ingest' | 'query';
}

export const ParticleFlow: React.FC<ParticleFlowProps> = ({ isTelemetryLive }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Initial particles
    particlesRef.current = [];

    const spawnParticle = (type: 'ingest' | 'query') => {
      particlesRef.current.push({
        x: type === 'ingest' ? width * 0.1 : width * 0.5,
        y: type === 'ingest' ? height * 0.5 : height * 0.45,
        speed: 0.005 + Math.random() * 0.008,
        color: type === 'ingest' ? '#00d2ff' : '#10b981',
        size: 1.5 + Math.random() * 2,
        progress: 0,
        type,
      });
    };

    let tick = 0;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      ctx.clearRect(0, 0, width, height);

      // If telemetry is live, continuously spawn dynamic particles (Mode A)
      if (isTelemetryLive) {
        tick++;
        if (tick % 6 === 0) spawnParticle('ingest');
        if (tick % 10 === 0) spawnParticle('query');
      }

      // Update & render particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.progress += p.speed;

        if (p.type === 'ingest') {
          // Flow: Left (10%) -> MemTable (35%)
          p.x = width * 0.1 + p.progress * (width * 0.25);
          p.y = height * 0.5 + Math.sin(p.progress * Math.PI * 4) * 8;
        } else {
          // Flow: Center Router (50%) -> Segments / HNSW (80%)
          p.x = width * 0.5 + p.progress * (width * 0.3);
          p.y = height * 0.45 + (p.progress * 40 - 20);
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.progress >= 1.0) {
          particlesRef.current.splice(i, 1);
        }
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isTelemetryLive]);

  return (
    <div className="data-flow-canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
};
