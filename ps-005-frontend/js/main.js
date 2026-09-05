import { initPipelineDiagram } from './pipeline-diagram.js';
import { initHNSWScene } from './hnsw-scene.js';
import { initBenchmarkChart } from './benchmark-chart.js';
import { runLoadSequence, runStageScroll } from './gsap-animations.js';

document.addEventListener('DOMContentLoaded', () => {
  const pipelineCanvas = document.getElementById('pipeline-canvas');
  if (pipelineCanvas) initPipelineDiagram(pipelineCanvas);

  const hnswContainer = document.getElementById('hnsw-scene');
  if (hnswContainer && window.THREE) initHNSWScene(hnswContainer);

  const benchCanvas = document.getElementById('benchmark-canvas');
  if (benchCanvas) initBenchmarkChart(benchCanvas);

  runLoadSequence();
  runStageScroll();

  // footer year stamp
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
