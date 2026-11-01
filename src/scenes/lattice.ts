// Procedural strut lattice that builds up from the base as the page scrolls.
// Nodes sit on a cubic grid clipped to a waisted column; struts join
// neighbouring nodes and are revealed in build order (bottom to top).
import * as THREE from 'three';
import type { SceneParts } from './runner';

export interface LatticeOptions { strut: string; strutTop: string; node: string }

export function buildLattice(o: LatticeOptions): SceneParts {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const nx = 7, ny = 16, nz = 7, s = 0.24;
  const inside = (i: number, j: number, k: number) => {
    const x = (i - (nx - 1) / 2) * s, z = (k - (nz - 1) / 2) * s, h = j / (ny - 1);
    const r = 0.78 - 0.32 * Math.sin(h * Math.PI); // waisted column
    return x * x + z * z <= r * r;
  };
  const P = (i: number, j: number, k: number) =>
    new THREE.Vector3((i - (nx - 1) / 2) * s, (j - (ny - 1) / 2) * s, (k - (nz - 1) / 2) * s);

  type Edge = { a: THREE.Vector3; b: THREE.Vector3; y: number };
  const edges: Edge[] = [];
  const nodes: THREE.Vector3[] = [];
  const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [0, 1, 1], [-1, 1, 0], [0, 1, -1]];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      for (let k = 0; k < nz; k++) {
        if (!inside(i, j, k)) continue;
        nodes.push(P(i, j, k));
        for (const [di, dj, dk] of dirs) {
          const i2 = i + di, j2 = j + dj, k2 = k + dk;
          if (i2 < 0 || i2 >= nx || j2 >= ny || k2 < 0 || k2 >= nz || !inside(i2, j2, k2)) continue;
          // Diagonals only on alternating cells, so the lattice reads as braced, not solid.
          if ((di || dk) && dj && (i + j + k) % 2) continue;
          const a = P(i, j, k), b = P(i2, j2, k2);
          edges.push({ a, b, y: Math.min(a.y, b.y) + Math.random() * 0.02 });
        }
      }
  edges.sort((e1, e2) => e1.y - e2.y);
  nodes.sort((n1, n2) => n1.y - n2.y);

  const strutGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1);
  strutGeo.translate(0, 0.5, 0);
  const strutMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 });
  const struts = new THREE.InstancedMesh(strutGeo, strutMat, edges.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const cA = new THREE.Color(o.strut), cB = new THREE.Color(o.strutTop), c = new THREE.Color();
  const minY = edges[0].y, maxY = edges[edges.length - 1].y;
  edges.forEach((e, n) => {
    const d = e.b.clone().sub(e.a);
    q.setFromUnitVectors(up, d.clone().normalize());
    m.compose(e.a, q, new THREE.Vector3(1, d.length(), 1));
    struts.setMatrixAt(n, m);
    struts.setColorAt(n, c.copy(cA).lerp(cB, (e.y - minY) / (maxY - minY)));
  });
  scene.add(struts);

  const nodeMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.026, 10, 8),
    new THREE.MeshStandardMaterial({ color: o.node, roughness: 0.4, metalness: 0.2 }),
    nodes.length,
  );
  nodes.forEach((p, n) => nodeMesh.setMatrixAt(n, m.makeTranslation(p.x, p.y, p.z)));
  scene.add(nodeMesh);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 4);
  scene.add(key);

  const group = new THREE.Group();
  scene.add(group);
  group.add(struts, nodeMesh);

  const update = (p: number, t: number) => {
    struts.count = Math.max(1, Math.floor(edges.length * p));
    const topY = edges[Math.max(0, struts.count - 1)].y;
    let nc = 0;
    while (nc < nodes.length && nodes[nc].y <= topY + 0.001) nc++;
    nodeMesh.count = nc;
    group.rotation.y = t * 0.1 + p * 1.2;
    const focus = -1.3 + 1.3 * p; // follow the top of the build
    camera.position.set(0, focus + 1.4, 7.4 + p * 1.2);
    camera.lookAt(0, focus, 0);
  };

  return { scene, camera, update, dispose() { strutGeo.dispose(); strutMat.dispose(); } };
}
