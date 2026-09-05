/**
 * hnsw-scene.js
 * -------------------------------------------------------------
 * A three.js scene representing embedding space as a sparse
 * point cloud connected into an HNSW-like proximity graph.
 * A query point periodically drops in and a greedy nearest-
 * neighbor walk highlights across the graph toward it —
 * this is the one "hero" 3D moment on the page, used once.
 *
 * Requires THREE (r128, no OrbitControls / no CapsuleGeometry).
 * -------------------------------------------------------------
 */
export function initHNSWScene(container) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // ---- generate a cluster of points (simulated embeddings) ----
  const COUNT = 140;
  const positions = [];
  const clusters = 4;
  for (let i = 0; i < COUNT; i++) {
    const c = i % clusters;
    const angle = (c / clusters) * Math.PI * 2;
    const cx = Math.cos(angle) * 2.4, cy = Math.sin(angle) * 2.4, cz = (Math.random() - 0.5) * 1.2;
    positions.push(
      cx + (Math.random() - 0.5) * 1.6,
      cy + (Math.random() - 0.5) * 1.6,
      cz + (Math.random() - 0.5) * 1.6
    );
  }

  const posArray = new Float32Array(positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

  const material = new THREE.PointsMaterial({
    color: 0xe9e5d8,
    size: 0.06,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // ---- build proximity edges: connect each point to its k nearest ----
  function vecAt(i) { return new THREE.Vector3(posArray[i * 3], posArray[i * 3 + 1], posArray[i * 3 + 2]); }
  const K = 3;
  const edgePositions = [];
  const adjacency = Array.from({ length: COUNT }, () => []);
  for (let i = 0; i < COUNT; i++) {
    const vi = vecAt(i);
    const dists = [];
    for (let j = 0; j < COUNT; j++) {
      if (i === j) continue;
      dists.push([j, vi.distanceTo(vecAt(j))]);
    }
    dists.sort((a, b) => a[1] - b[1]);
    for (let k = 0; k < K; k++) {
      const j = dists[k][0];
      adjacency[i].push(j);
      const vj = vecAt(j);
      edgePositions.push(vi.x, vi.y, vi.z, vj.x, vj.y, vj.z);
    }
  }
  const edgeGeom = new THREE.BufferGeometry();
  edgeGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgePositions), 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4a5468, transparent: true, opacity: 0.35 });
  const edges = new THREE.LineSegments(edgeGeom, edgeMat);
  scene.add(edges);

  // ---- query walk highlight ----
  const walkGeom = new THREE.BufferGeometry();
  walkGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60), 3));
  const walkMat = new THREE.LineBasicMaterial({ color: 0xc08a4e, transparent: true, opacity: 0 });
  const walkLine = new THREE.Line(walkGeom, walkMat);
  scene.add(walkLine);

  const queryGeom = new THREE.SphereGeometry(0.09, 16, 16);
  const queryMat = new THREE.MeshBasicMaterial({ color: 0xc08a4e, transparent: true, opacity: 0 });
  const queryMesh = new THREE.Mesh(queryGeom, queryMat);
  scene.add(queryMesh);

  function greedyWalk(targetIdx, startIdx) {
    const path = [startIdx];
    let current = startIdx;
    const target = vecAt(targetIdx);
    for (let hop = 0; hop < 8; hop++) {
      const neighbors = adjacency[current];
      let best = current, bestDist = vecAt(current).distanceTo(target);
      neighbors.forEach(n => {
        const d = vecAt(n).distanceTo(target);
        if (d < bestDist) { bestDist = d; best = n; }
      });
      if (best === current) break;
      path.push(best);
      current = best;
    }
    return path;
  }

  let walkCycle = 0;
  function triggerQuery() {
    const targetIdx = Math.floor(Math.random() * COUNT);
    const startIdx = (targetIdx + Math.floor(COUNT / 2)) % COUNT;
    const path = greedyWalk(targetIdx, startIdx);
    const arr = walkGeom.attributes.position.array;
    for (let i = 0; i < path.length; i++) {
      const v = vecAt(path[i]);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    walkGeom.setDrawRange(0, path.length);
    walkGeom.attributes.position.needsUpdate = true;

    const tv = vecAt(targetIdx);
    queryMesh.position.copy(tv);

    walkMat.opacity = 1;
    queryMat.opacity = 1;
    walkCycle = 0;
  }

  if (!reduceMotion) {
    setInterval(triggerQuery, 3400);
    triggerQuery();
  }

  let raf;
  function animate() {
    raf = requestAnimationFrame(animate);
    if (!reduceMotion) {
      scene.rotation.y += 0.0016;
      scene.rotation.x = Math.sin(Date.now() * 0.0002) * 0.08;
      walkCycle += 0.01;
      if (walkMat.opacity > 0) {
        walkMat.opacity = Math.max(0, walkMat.opacity - 0.004);
        queryMat.opacity = walkMat.opacity;
      }
    }
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    }
  };
}
