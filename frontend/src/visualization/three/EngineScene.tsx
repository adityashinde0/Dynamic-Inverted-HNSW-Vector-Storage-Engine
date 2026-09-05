import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

export type PerspectiveMode = 'overview' | 'writePath' | 'queryPath' | 'hnsw';

interface EngineSceneProps {
  perspective: PerspectiveMode;
  onNodeSelect?: (nodeType: string) => void;
  fillPct?: number;
}

export const EngineScene: React.FC<EngineSceneProps> = ({
  perspective,
  onNodeSelect,
  fillPct = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<THREE.Points | null>(null);
  const memtableFillMeshRef = useRef<THREE.Mesh | null>(null);
  const interactiveMeshesRef = useRef<{ mesh: THREE.Object3D; name: string }[]>([]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene with Deep Atmospheric Fog
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x03060d, 0.015);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 11, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer with High Dynamic Range & Transparent Background
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // 4. Subtle Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const cyanLight = new THREE.DirectionalLight(0x00d2ff, 1.8);
    cyanLight.position.set(10, 20, 15);
    scene.add(cyanLight);

    const blueLight = new THREE.DirectionalLight(0x3b82f6, 1.2);
    blueLight.position.set(-15, 15, -10);
    scene.add(blueLight);

    // 5. Subtle Technical Perspective Grid Floor
    const grid = new THREE.GridHelper(50, 50, 0x00d2ff, 0x0b1320);
    grid.position.y = -3.2;
    scene.add(grid);

    interactiveMeshesRef.current = [];

    // Helper: Clean Non-Overlapping Canvas Texture Label
    const createCleanStageLabel = (title: string, sub: string, x: number, y: number, z: number) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(title, 128, 24);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '13px Outfit, sans-serif';
        ctx.fillText(sub, 128, 46);
      }
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85 });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, y, z);
      sprite.scale.set(3.2, 0.8, 1);
      scene.add(sprite);
    };

    // ------------------------------------------------------------------------
    // STAGE 1: INGESTION FUNNEL (Far Left: x = -14)
    // ------------------------------------------------------------------------
    const ingestGroup = new THREE.Group();
    ingestGroup.position.set(-14, 0, 0);

    const apertureGeo = new THREE.TorusGeometry(1.4, 0.07, 16, 32);
    const apertureMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const aperture = new THREE.Mesh(apertureGeo, apertureMat);
    aperture.rotation.y = Math.PI / 2;
    ingestGroup.add(aperture);

    // Laser stream fibers entering
    const fiberCount = 30;
    const fiberGeo = new THREE.BufferGeometry();
    const fiberPos = new Float32Array(fiberCount * 6);
    for (let i = 0; i < fiberCount; i++) {
      const idx = i * 6;
      const angle = (i / fiberCount) * Math.PI * 2;
      const r = 2.5 + Math.random() * 1.5;
      fiberPos[idx] = -5 - Math.random() * 3;
      fiberPos[idx + 1] = Math.sin(angle) * r;
      fiberPos[idx + 2] = Math.cos(angle) * r;
      fiberPos[idx + 3] = 0;
      fiberPos[idx + 4] = Math.sin(angle) * 1.3;
      fiberPos[idx + 5] = Math.cos(angle) * 1.3;
    }
    fiberGeo.setAttribute('position', new THREE.BufferAttribute(fiberPos, 3));
    const fiberMat = new THREE.LineBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.65 });
    const fibers = new THREE.LineSegments(fiberGeo, fiberMat);
    ingestGroup.add(fibers);

    scene.add(ingestGroup);
    interactiveMeshesRef.current.push({ mesh: ingestGroup, name: 'ingest' });
    createCleanStageLabel('INGEST', '12.4K vec/s', -14, 3.2, 0);

    // ------------------------------------------------------------------------
    // STAGE 2: WAL (Durable Log: x = -8.5)
    // ------------------------------------------------------------------------
    const walGroup = new THREE.Group();
    walGroup.position.set(-8.5, 0, 0);

    const walBoxGeo = new THREE.BoxGeometry(2.6, 2.8, 2.6);
    const walBoxMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const walBox = new THREE.Mesh(walBoxGeo, walBoxMat);
    walGroup.add(walBox);

    // Stacked internal log slabs
    for (let l = -0.9; l <= 0.9; l += 0.45) {
      const slabGeo = new THREE.BoxGeometry(2.3, 0.08, 2.3);
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x003344,
        emissive: 0x00d2ff,
        emissiveIntensity: 0.4,
      });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = l;
      walGroup.add(slab);
    }

    scene.add(walGroup);
    interactiveMeshesRef.current.push({ mesh: walGroup, name: 'wal' });
    createCleanStageLabel('WAL', 'Durable Log', -8.5, 3.2, 0);

    // Connecting beam WAL -> MemTable
    const tubeGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.6 });
    const beam1 = new THREE.Mesh(tubeGeo, tubeMat);
    beam1.rotation.z = Math.PI / 2;
    beam1.position.set(-5.6, 0, 0);
    scene.add(beam1);

    // ------------------------------------------------------------------------
    // STAGE 3: MEMTABLE (In-Memory Reservoir: x = -2.8)
    // ------------------------------------------------------------------------
    const memGroup = new THREE.Group();
    memGroup.position.set(-2.8, 0, 0);

    const memGlassGeo = new THREE.BoxGeometry(2.8, 3.0, 2.8);
    const memGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x00d2ff,
      transmission: 0.85,
      opacity: 0.35,
      transparent: true,
      roughness: 0.1,
      ior: 1.4,
    });
    const memGlass = new THREE.Mesh(memGlassGeo, memGlassMat);
    memGroup.add(memGlass);

    // Internal floating particle cluster
    const pCount = 140;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let p = 0; p < pCount * 3; p += 3) {
      pPos[p] = (Math.random() - 0.5) * 2.0;
      pPos[p + 1] = (Math.random() - 0.5) * 2.0;
      pPos[p + 2] = (Math.random() - 0.5) * 2.0;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.15,
      transparent: true,
      opacity: 0.9,
    });
    const memParticles = new THREE.Points(pGeo, pMat);
    memGroup.add(memParticles);
    particlesRef.current = memParticles;

    // Fill level geometry
    const fillGeo = new THREE.BoxGeometry(2.4, 0.8, 2.4);
    const fillMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x005577,
      transparent: true,
      opacity: 0.5,
    });
    const fillBox = new THREE.Mesh(fillGeo, fillMat);
    fillBox.position.y = -1.0;
    memGroup.add(fillBox);
    memtableFillMeshRef.current = fillBox;

    scene.add(memGroup);
    interactiveMeshesRef.current.push({ mesh: memGroup, name: 'memtable' });
    createCleanStageLabel('MEMTABLE', 'In-Memory', -2.8, 3.2, 0);

    // Connecting beam MemTable -> Segments
    const beam2 = new THREE.Mesh(tubeGeo, tubeMat);
    beam2.rotation.z = Math.PI / 2;
    beam2.position.set(-0.2, 0, 0);
    scene.add(beam2);

    // ------------------------------------------------------------------------
    // STAGE 4: SEGMENTS (Immutable Micro-Cubes: x = 2.4)
    // ------------------------------------------------------------------------
    const segGroup = new THREE.Group();
    segGroup.position.set(2.4, 0, 0);

    for (let b = 0; b < 2; b++) {
      const sGeo = new THREE.BoxGeometry(2.4, 1.2, 2.4);
      const sMat = new THREE.MeshStandardMaterial({
        color: 0x08101e,
        emissive: 0x0369a1,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.7,
      });
      const sMesh = new THREE.Mesh(sGeo, sMat);
      sMesh.position.y = b === 0 ? -0.7 : 0.7;

      const edgeGeo = new THREE.EdgesGeometry(sGeo);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.7 });
      sMesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
      segGroup.add(sMesh);
    }

    scene.add(segGroup);
    interactiveMeshesRef.current.push({ mesh: segGroup, name: 'segments' });
    createCleanStageLabel('SEGMENTS', 'Immutable Storage', 2.4, 3.2, 0);

    // Connecting beam Segments -> HNSW
    const beam3 = new THREE.Mesh(tubeGeo, tubeMat);
    beam3.rotation.z = Math.PI / 2;
    beam3.position.set(5.2, 0, 0);
    scene.add(beam3);

    // ------------------------------------------------------------------------
    // STAGE 5: HNSW GRAPH (Celestial Vector Constellation: x = 8.5)
    // ------------------------------------------------------------------------
    const hnswGroup = new THREE.Group();
    hnswGroup.position.set(8.5, 0, 0);

    const nodeCount = 32;
    const hnswNodes: THREE.Vector3[] = [];
    const sphereGeo = new THREE.SphereGeometry(0.18, 12, 12);

    for (let n = 0; n < nodeCount; n++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 2.0;
      const sinPhi = Math.sin(phi);

      const pos = new THREE.Vector3(
        r * sinPhi * Math.cos(theta),
        r * sinPhi * Math.sin(theta),
        r * Math.cos(phi)
      );
      hnswNodes.push(pos);

      const color = n % 4 === 0 ? 0xf59e0b : n % 2 === 0 ? 0x00d2ff : 0x3b82f6;
      const sMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.65 });
      const sNode = new THREE.Mesh(sphereGeo, sMat);
      sNode.position.copy(pos);
      hnswGroup.add(sNode);
    }

    // Connect proximate nodes with glowing lines
    const lineCoords: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (hnswNodes[i].distanceTo(hnswNodes[j]) < 1.3) {
          lineCoords.push(hnswNodes[i].x, hnswNodes[i].y, hnswNodes[i].z);
          lineCoords.push(hnswNodes[j].x, hnswNodes[j].y, hnswNodes[j].z);
        }
      }
    }
    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineCoords, 3));
    const linesMat = new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.55 });
    hnswGroup.add(new THREE.LineSegments(linesGeo, linesMat));

    scene.add(hnswGroup);
    interactiveMeshesRef.current.push({ mesh: hnswGroup, name: 'hnsw-traversal' });
    createCleanStageLabel('HNSW INDEX', 'Search Graph', 8.5, 3.2, 0);

    // ------------------------------------------------------------------------
    // STAGE 6: QUERY & TOP-K (Floating Scorecard: x = 14)
    // ------------------------------------------------------------------------
    const queryGroup = new THREE.Group();
    queryGroup.position.set(14, 0, 0);

    const scCanvas = document.createElement('canvas');
    scCanvas.width = 160;
    scCanvas.height = 200;
    const scCtx = scCanvas.getContext('2d');
    if (scCtx) {
      scCtx.fillStyle = 'rgba(8, 14, 24, 0.9)';
      scCtx.fillRect(0, 0, 160, 200);
      scCtx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
      scCtx.lineWidth = 2;
      scCtx.strokeRect(2, 2, 156, 196);

      scCtx.fillStyle = '#00d2ff';
      scCtx.font = 'bold 12px "JetBrains Mono", monospace';
      scCtx.fillText('TOP-K RESULTS', 16, 26);

      const items = ['#1  0.982', '#2  0.976', '#3  0.961', '#4  0.948', '#5  0.934'];
      scCtx.font = '12px "JetBrains Mono", monospace';
      items.forEach((item, idx) => {
        scCtx.fillStyle = idx < 2 ? '#10b981' : '#ffffff';
        scCtx.fillText(item, 18, 54 + idx * 30);
      });
    }

    const cardTex = new THREE.CanvasTexture(scCanvas);
    const cardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 2.9),
      new THREE.MeshBasicMaterial({ map: cardTex, transparent: true })
    );
    queryGroup.add(cardMesh);

    // Connecting laser fibers from HNSW to Top-K
    const outBeams = 4;
    const outGeo = new THREE.BufferGeometry();
    const outPos = new Float32Array(outBeams * 6);
    for (let b = 0; b < outBeams; b++) {
      const idx = b * 6;
      outPos[idx] = -3.2;
      outPos[idx + 1] = (Math.random() - 0.5) * 1.2;
      outPos[idx + 2] = (Math.random() - 0.5) * 1.2;
      outPos[idx + 3] = -1.2;
      outPos[idx + 4] = 0.8 - b * 0.45;
      outPos[idx + 5] = 0;
    }
    outGeo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
    queryGroup.add(new THREE.LineSegments(outGeo, new THREE.LineBasicMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.75 })));

    scene.add(queryGroup);
    interactiveMeshesRef.current.push({ mesh: queryGroup, name: 'topk' });
    createCleanStageLabel('QUERY', 'Top-K Results', 14, 3.2, 0);

    // ------------------------------------------------------------------------
    // Animation Loop
    // ------------------------------------------------------------------------
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      hnswGroup.rotation.y += 0.2 * delta;
      aperture.rotation.z += 0.4 * delta;
      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.25 * delta;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Raycast Interaction
    const handleCanvasClick = (e: MouseEvent) => {
      if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const targets = interactiveMeshesRef.current.map((item) => item.mesh);
      const intersects = raycaster.intersectObjects(targets, true);

      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj && hitObj.parent && hitObj.parent !== sceneRef.current) {
          hitObj = hitObj.parent;
        }
        const match = interactiveMeshesRef.current.find((item) => item.mesh === hitObj);
        if (match && onNodeSelect) {
          onNodeSelect(match.name);
        }
      }
    };

    const canvasEl = canvasRef.current;
    canvasEl.addEventListener('click', handleCanvasClick);

    // Lifecycle cleanup
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      canvasEl.removeEventListener('click', handleCanvasClick);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [onNodeSelect]);

  // Perspective Camera Transitions
  useEffect(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;

    let targetPos = { x: 0, y: 11, z: 30 };
    let lookTarget = { x: 0, y: 0, z: 0 };

    switch (perspective) {
      case 'overview':
        targetPos = { x: 0, y: 11, z: 30 };
        lookTarget = { x: 0, y: 0, z: 0 };
        break;
      case 'writePath':
        targetPos = { x: -8.5, y: 7, z: 18 };
        lookTarget = { x: -7, y: 0, z: 0 };
        break;
      case 'queryPath':
        targetPos = { x: 9.5, y: 7, z: 20 };
        lookTarget = { x: 10, y: 0, z: 0 };
        break;
      case 'hnsw':
        targetPos = { x: 8.5, y: 4.5, z: 9 };
        lookTarget = { x: 8.5, y: 0, z: 0 };
        break;
    }

    gsap.to(cam.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => {
        cam.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
      },
    });
  }, [perspective]);

  // Update MemTable fill
  useEffect(() => {
    if (!memtableFillMeshRef.current) return;
    const height = Math.max(0.1, (fillPct / 100) * 2.2);
    memtableFillMeshRef.current.scale.set(1, height, 1);
    memtableFillMeshRef.current.position.y = -1.1 + height / 2;
  }, [fillPct]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};
