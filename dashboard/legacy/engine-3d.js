/**
 * PS-005 Vector Storage Engine — 3D Spatial Architecture Visualizer
 * Powered by Three.js & GSAP
 *
 * Implements the core technical storytelling of PS-005:
 * 1. Write Ingestion Stream: gRPC Router -> WAL -> Active MemTable (Lock-Free Reservoir)
 * 2. Atomic Rotation: Sealed MemTable -> Background Rayon Builder -> Immutable Segments
 * 3. Concurrent Search Fan-Out: Query Router -> Parallel MemTable & Multi-Segment HNSW Traversal
 * 4. Spatial HNSW Multi-Layer Skip-List: Layer 2 (Express) -> Layer 1 (Regional) -> Layer 0 (Ground)
 *
 * Rule 1: The architecture is the visual identity.
 * Rule 7: Labeled explicitly as "REPRESENTATIVE HNSW VIEW".
 * Rule 35: No decorative-only 3D; every element represents real engine components.
 */

class Engine3DVisualizer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container || typeof THREE === 'undefined') {
      console.warn('Three.js or container not available for Engine3DVisualizer');
      return;
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animFrameId = null;

    // Component Groups
    this.rootGroup = null;
    this.routerGroup = null;
    this.memtableGroup = null;
    this.walGroup = null;
    this.segmentsGroup = null;
    this.hnswGroup = null;
    this.beamsGroup = null;

    // Particle Lattice for Active MemTable
    this.memtableParticles = null;
    this.memParticleCount = 180;
    this.memtableFillRatio = 0.0;

    // Interaction & Mouse
    this.mouse = new THREE.Vector2(0, 0);
    this.targetRotation = { x: 0.15, y: -0.2 };
    this.currentRotation = { x: 0.15, y: -0.2 };
    this.raycaster = new THREE.Raycaster();
    this.interactiveObjects = [];

    // State
    this.isQuerying = false;
    this.isDisposed = false;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 1200;
    const height = this.container.clientHeight || 560;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0d14, 0.012);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    this.camera.position.set(0, 28, 62);
    this.camera.lookAt(0, -2, 0);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Clear old canvases if any
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.setupLighting();

    // 5. Build 3D Architecture
    this.buildArchitectureScene();

    // 6. Event Listeners
    this.bindEvents();

    // 7. Render Loop
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x2d3748, 1.2);
    this.scene.add(ambientLight);

    // Directional Core Lights
    const cyanLight = new THREE.DirectionalLight(0x00d2ff, 1.8);
    cyanLight.position.set(-20, 40, 25);
    this.scene.add(cyanLight);

    const emeraldLight = new THREE.DirectionalLight(0x10b981, 1.4);
    emeraldLight.position.set(25, 30, 20);
    this.scene.add(emeraldLight);

    const purpleLight = new THREE.DirectionalLight(0xa855f7, 0.8);
    purpleLight.position.set(0, -25, -20);
    this.scene.add(purpleLight);
  }

  buildArchitectureScene() {
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // Stage 1: Spatial Grid Platform (Obsidian Vector Ground)
    const gridHelper = new THREE.GridHelper(70, 35, 0x1e2638, 0x121722);
    gridHelper.position.y = -14;
    this.rootGroup.add(gridHelper);

    // Stage 2: Top Search Router & Ingestion Gateway
    this.buildSearchRouter();

    // Stage 3: WAL Pipeline Channel (Durability INV-01)
    this.buildWalPipeline();

    // Stage 4: Active MemTable Reservoir (Lock-free Buffer)
    this.buildMemTableReservoir();

    // Stage 5: Immutable Disk Segments & HNSW Multi-Layer Graphs
    this.buildSegmentsWithHnsw();

    // Stage 6: Beams & Traversal Group
    this.beamsGroup = new THREE.Group();
    this.rootGroup.add(this.beamsGroup);
  }

  // --------------------------------------------------------------------------
  // Architecture Components
  // --------------------------------------------------------------------------

  buildSearchRouter() {
    this.routerGroup = new THREE.Group();
    this.routerGroup.position.set(0, 14, -4);

    // Router Hexagonal Core
    const coreGeo = new THREE.CylinderGeometry(4.2, 4.6, 2.2, 6);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x131d2e,
      roughness: 0.3,
      metalness: 0.8,
      wireframe: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = 'node_router';
    this.interactiveObjects.push(core);
    this.routerGroup.add(core);

    // Outer Neon Ring
    const ringGeo = new THREE.TorusGeometry(5.4, 0.12, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    this.routerGroup.add(ring);

    this.rootGroup.add(this.routerGroup);
  }

  buildWalPipeline() {
    this.walGroup = new THREE.Group();
    this.walGroup.position.set(-14, 2, 2);

    // Linear Append Log Tube (INV-01)
    const curve = new THREE.LineCurve3(new THREE.Vector3(-6, 8, -4), new THREE.Vector3(0, 0, 0));
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.65, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      emissive: 0x004e60,
      roughness: 0.4,
      metalness: 0.7,
      transparent: true,
      opacity: 0.85
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.name = 'node_wal';
    this.interactiveObjects.push(tube);
    this.walGroup.add(tube);

    // WAL Checkpoint Rings (Representing CRC32 Validated Commits)
    for (let i = 0; i < 4; i++) {
      const ringG = new THREE.TorusGeometry(0.95, 0.08, 12, 24);
      const ringM = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
      const rMesh = new THREE.Mesh(ringG, ringM);
      const t = i / 3;
      rMesh.position.lerpVectors(new THREE.Vector3(-6, 8, -4), new THREE.Vector3(0, 0, 0), t);
      rMesh.lookAt(0, 0, 0);
      this.walGroup.add(rMesh);
    }

    this.rootGroup.add(this.walGroup);
  }

  buildMemTableReservoir() {
    this.memtableGroup = new THREE.Group();
    this.memtableGroup.position.set(-14, -4, 4);

    // Glassmorphic Reservoir Cylinder (Lock-Free Dynamic Buffer)
    const vesselGeo = new THREE.CylinderGeometry(5.2, 5.2, 7.5, 32, 1, true);
    const vesselMat = new THREE.MeshPhysicalMaterial({
      color: 0x162338,
      transmission: 0.75,
      opacity: 0.65,
      transparent: true,
      roughness: 0.2,
      ior: 1.4,
      side: THREE.DoubleSide
    });
    const vessel = new THREE.Mesh(vesselGeo, vesselMat);
    vessel.name = 'node_memtable';
    this.interactiveObjects.push(vessel);
    this.memtableGroup.add(vessel);

    // Upper/Lower Structural Collars
    const collarGeo = new THREE.TorusGeometry(5.25, 0.18, 16, 48);
    const collarMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const topCollar = new THREE.Mesh(collarGeo, collarMat);
    topCollar.rotation.x = Math.PI / 2;
    topCollar.position.y = 3.75;
    this.memtableGroup.add(topCollar);

    const botCollar = topCollar.clone();
    botCollar.position.y = -3.75;
    this.memtableGroup.add(botCollar);

    // Vector Particle Lattice inside Reservoir
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(this.memParticleCount * 3);
    for (let i = 0; i < this.memParticleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * 4.4;
      const y = (Math.random() - 0.5) * 6.5;
      pPositions[i * 3] = Math.cos(theta) * r;
      pPositions[i * 3 + 1] = y;
      pPositions[i * 3 + 2] = Math.sin(theta) * r;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0x00d2ff,
      size: 0.45,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    this.memtableParticles = new THREE.Points(pGeo, pMat);
    this.memtableGroup.add(this.memtableParticles);

    this.rootGroup.add(this.memtableGroup);
  }

  buildSegmentsWithHnsw() {
    this.segmentsGroup = new THREE.Group();
    this.segmentsGroup.position.set(10, -5, 2);

    // Stacked Immutable Disk Segment Slabs (S-001, S-002, S-003)
    const segmentCount = 3;
    const slabWidth = 14;
    const slabDepth = 11;
    const slabHeight = 1.6;

    for (let i = 0; i < segmentCount; i++) {
      const yOffset = i * 3.4;
      const slabGeo = new THREE.BoxGeometry(slabWidth, slabHeight, slabDepth);
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x121a28,
        roughness: 0.35,
        metalness: 0.75,
        transparent: true,
        opacity: 0.92
      });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(0, yOffset - 4, 0);
      slab.name = `node_segment_${i + 1}`;
      this.interactiveObjects.push(slab);
      this.segmentsGroup.add(slab);

      // Edge Accent (Emerald indicating Searchable State)
      const wireGeo = new THREE.EdgesGeometry(slabGeo);
      const wireMat = new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45 });
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      slab.add(wire);
    }

    // 3D Representative HNSW Skip-List Layers (Labeled Representative View)
    this.buildHnswLayeredGraph();

    this.rootGroup.add(this.segmentsGroup);
  }

  buildHnswLayeredGraph() {
    this.hnswGroup = new THREE.Group();
    this.hnswGroup.position.set(0, 5.5, 0);

    // Multi-Layer Hierarchy: Layer 2 (Express), Layer 1 (Regional), Layer 0 (Dense Ground)
    const layers = [
      { name: 'Layer 2 (Express Entry)', y: 5.5, nodeCount: 3, radius: 4.5, color: 0x00d2ff, nodeSize: 0.45 },
      { name: 'Layer 1 (Regional Routing)', y: 2.8, nodeCount: 7, radius: 5.5, color: 0xa855f7, nodeSize: 0.35 },
      { name: 'Layer 0 (Dense Ground Graph)', y: 0.0, nodeCount: 16, radius: 6.2, color: 0x10b981, nodeSize: 0.28 }
    ];

    layers.forEach((lvl) => {
      const nodes = [];
      const layerGroup = new THREE.Group();
      layerGroup.position.y = lvl.y;

      for (let i = 0; i < lvl.nodeCount; i++) {
        const theta = (i / lvl.nodeCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
        const r = (lvl.radius * 0.4) + Math.random() * (lvl.radius * 0.6);
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;

        const sphereG = new THREE.SphereGeometry(lvl.nodeSize, 12, 12);
        const sphereM = new THREE.MeshBasicMaterial({ color: lvl.color });
        const sphere = new THREE.Mesh(sphereG, sphereM);
        sphere.position.set(x, 0, z);
        layerGroup.add(sphere);
        nodes.push(new THREE.Vector3(x, lvl.y, z));
      }

      // Interconnect Layer Edges
      for (let i = 0; i < nodes.length; i++) {
        const nextIdx = (i + 1) % nodes.length;
        const edgeGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(nodes[i].x, 0, nodes[i].z),
          new THREE.Vector3(nodes[nextIdx].x, 0, nodes[nextIdx].z)
        ]);
        const edgeMat = new THREE.LineBasicMaterial({ color: lvl.color, transparent: true, opacity: 0.35 });
        const edge = new THREE.Line(edgeGeo, edgeMat);
        layerGroup.add(edge);
      }

      this.hnswGroup.add(layerGroup);
    });

    this.segmentsGroup.add(this.hnswGroup);
  }

  // --------------------------------------------------------------------------
  // Dynamic Traversal & Telemetry Animations
  // --------------------------------------------------------------------------

  triggerQueryBeam(queryId, onComplete) {
    if (this.isQuerying || !this.beamsGroup) return;
    this.isQuerying = true;

    while (this.beamsGroup.children.length > 0) {
      const obj = this.beamsGroup.children.pop();
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }

    const routerPos = new THREE.Vector3(0, 13, -4);
    const memtablePos = new THREE.Vector3(-14, -4, 4);
    const segmentPos = new THREE.Vector3(10, -2, 2);

    // 1. Fan-out path 1: Router -> Active MemTable
    const beam1 = this.createPulsingBeam(routerPos, memtablePos, 0x00d2ff);
    this.beamsGroup.add(beam1);

    // 2. Fan-out path 2: Router -> Immutable Segments
    const beam2 = this.createPulsingBeam(routerPos, segmentPos, 0x10b981);
    this.beamsGroup.add(beam2);

    // 3. Traversal Flash along HNSW Skip-List
    if (typeof gsap !== 'undefined') {
      gsap.to(this.hnswGroup.rotation, {
        y: this.hnswGroup.rotation.y + Math.PI * 0.75,
        duration: 0.9,
        ease: 'power2.out'
      });
    }

    setTimeout(() => {
      if (this.beamsGroup) {
        while (this.beamsGroup.children.length > 0) {
          const obj = this.beamsGroup.children.pop();
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        }
      }
      this.isQuerying = false;
      if (onComplete) onComplete();
    }, 1200);
  }

  createPulsingBeam(start, end, colorHex) {
    const curve = new THREE.LineCurve3(start, end);
    const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.22, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    return new THREE.Mesh(tubeGeo, tubeMat);
  }

  triggerIngestPulse(count) {
    if (!this.memtableParticles) return;
    if (typeof gsap !== 'undefined') {
      gsap.to(this.memtableParticles.rotation, {
        y: this.memtableParticles.rotation.y + 0.8,
        duration: 0.6,
        ease: 'power1.out'
      });
      gsap.fromTo(
        this.memtableParticles.material,
        { size: 0.85, opacity: 1.0 },
        { size: 0.45, opacity: 0.85, duration: 0.7 }
      );
    }
  }

  updateMemtableFill(pct) {
    this.memtableFillRatio = Math.min(Math.max(pct / 100, 0), 1.0);
    if (this.memtableParticles) {
      this.memtableParticles.material.color.setHex(this.memtableFillRatio >= 0.9 ? 0xf59e0b : 0x00d2ff);
    }
  }

  // --------------------------------------------------------------------------
  // Camera Perspectives (GSAP Transitions)
  // --------------------------------------------------------------------------

  setPerspective(mode) {
    if (!this.camera || typeof gsap === 'undefined') return;

    let targetPos = { x: 0, y: 28, z: 62 };
    let targetLook = { x: 0, y: -2, z: 0 };

    switch (mode) {
      case 'overview':
        targetPos = { x: 0, y: 28, z: 62 };
        targetLook = { x: 0, y: -2, z: 0 };
        break;

      case 'writePath':
        targetPos = { x: -26, y: 16, z: 34 };
        targetLook = { x: -14, y: -2, z: 2 };
        break;

      case 'queryPath':
        targetPos = { x: 4, y: 32, z: 42 };
        targetLook = { x: 0, y: 4, z: -2 };
        break;

      case 'hnsw':
        targetPos = { x: 24, y: 12, z: 28 };
        targetLook = { x: 10, y: 2, z: 2 };
        break;
    }

    gsap.to(this.camera.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => this.camera.lookAt(targetLook.x, targetLook.y, targetLook.z)
    });
  }

  // --------------------------------------------------------------------------
  // Events & Interaction
  // --------------------------------------------------------------------------

  bindEvents() {
    window.addEventListener('resize', () => this.handleResize());

    this.container.addEventListener('mousemove', (e) => {
      const rect = this.container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      this.mouse.set(x, y);

      this.targetRotation.y = -0.2 + x * 0.18;
      this.targetRotation.x = 0.15 - y * 0.12;
    });

    this.container.addEventListener('click', (e) => {
      const rect = this.container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

      const intersects = this.raycaster.intersectObjects(this.interactiveObjects, false);
      if (intersects.length > 0) {
        const hitName = intersects[0].object.name;
        this.handleObjectClick(hitName);
      }
    });
  }

  handleObjectClick(name) {
    if (!window.app) return;
    if (name === 'node_router') window.app.handleNodeClick('query-router');
    else if (name === 'node_wal') window.app.handleNodeClick('wal');
    else if (name === 'node_memtable') window.app.handleNodeClick('memtable');
    else if (name.startsWith('node_segment')) window.app.handleNodeClick('segments');
  }

  handleResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 560;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --------------------------------------------------------------------------
  // Animation Loop & Lifecycle
  // --------------------------------------------------------------------------

  animate() {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(() => this.animate());

    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.05;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.05;
    if (this.rootGroup) {
      this.rootGroup.rotation.x = this.currentRotation.x;
      this.rootGroup.rotation.y = this.currentRotation.y;
    }

    if (this.memtableParticles) {
      this.memtableParticles.rotation.y += 0.003;
    }
    if (this.hnswGroup) {
      this.hnswGroup.rotation.y += 0.002;
    }
    if (this.routerGroup) {
      this.routerGroup.rotation.y += 0.004;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.isDisposed = true;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    window.removeEventListener('resize', () => this.handleResize());

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }
  }
}

window.Engine3DVisualizer = Engine3DVisualizer;
