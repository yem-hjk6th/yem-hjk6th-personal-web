// Procedural extrusion beads: a toolpath is swept with an elliptical bead
// cross-section and stacked layer by layer, the way a robot extruder prints.
// The bead swells where the path turns sharply, because the robot slows at
// corners while the extruder keeps its commanded speed.
import * as THREE from 'three';
import type { SceneParts } from './runner';

type V2 = [number, number];

export interface BeadOptions {
  path: 'column' | 'hilbert';
  colorA: string;   // bead on straight runs
  colorB: string;   // bead where it swells at corners
  nozzle: string;
}

function hilbertPath(order: number, size: number): V2[] {
  const n = 2 ** order, pts: V2[] = [];
  for (let d = 0; d < n * n; d++) {
    let x = 0, y = 0, t = d;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t / 2), ry = 1 & (t ^ rx);
      if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } [x, y] = [y, x]; }
      x += s * rx; y += s * ry; t = Math.floor(t / 4);
    }
    pts.push([(x / (n - 1) - 0.5) * size, (y / (n - 1) - 0.5) * size]);
  }
  // Resample each straight segment so the sweep has enough rings.
  const out: V2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let k = 0; k < 6; k++) out.push([ax + ((bx - ax) * k) / 6, ay + ((by - ay) * k) / 6]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function columnLayer(layer: number, layers: number, samples: number): V2[] {
  // Rounded-square contour that twists and swells with height.
  const h = layer / (layers - 1);
  const twist = h * 0.9;
  const scale = 1 + 0.18 * Math.sin(h * Math.PI) - 0.08 * h;
  const pts: V2[] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a), p = 0.32; // superellipse exponent
    const x = Math.sign(c) * Math.pow(Math.abs(c), p), y = Math.sign(s) * Math.pow(Math.abs(s), p);
    const ca = Math.cos(twist), sa = Math.sin(twist);
    pts.push([(x * ca - y * sa) * scale, (x * sa + y * ca) * scale]);
  }
  return pts;
}

export function buildBeads(o: BeadOptions): SceneParts {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  const isColumn = o.path === 'column';
  const layers = isColumn ? 34 : 6;
  const radial = 8;
  const beadW = isColumn ? 0.05 : 0.026, beadH = isColumn ? 0.032 : 0.022;
  const layerGap = beadH * 1.75;
  const closed = isColumn;

  const pos: number[] = [], col: number[] = [], nrm: number[] = [], idx: number[] = [];
  const centers: THREE.Vector3[] = []; // deposition order, for the nozzle
  const ca = new THREE.Color(o.colorA), cb = new THREE.Color(o.colorB), tmp = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  const segIndexEnd: number[] = []; // index count after each ring segment, for nozzle lookup

  for (let L = 0; L < layers; L++) {
    const path = isColumn ? columnLayer(L, layers, 300) : hilbertPath(4, 2.2);
    const n = path.length, y = L * layerGap;
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const prev = path[(i - 1 + n) % n], cur = path[i], next = path[(i + 1) % n];
      const atEnd = !closed && (i === 0 || i === n - 1);
      const tx = atEnd ? (i === 0 ? next[0] - cur[0] : cur[0] - prev[0]) : next[0] - prev[0];
      const tz = atEnd ? (i === 0 ? next[1] - cur[1] : cur[1] - prev[1]) : next[1] - prev[1];
      const t = new THREE.Vector3(tx, 0, tz).normalize();
      // Turning angle -> slowdown -> wider bead.
      let turn = 0;
      if (!atEnd) {
        const a1 = Math.atan2(cur[1] - prev[1], cur[0] - prev[0]), a2 = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
        turn = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
      }
      const swell = Math.min(1, turn * (isColumn ? 9 : 0.45));
      const w = beadW * (1 + 0.6 * swell);
      const side = new THREE.Vector3().crossVectors(t, Y).normalize();
      const c = new THREE.Vector3(cur[0], y, cur[1]);
      centers.push(c);
      tmp.copy(ca).lerp(cb, swell);
      for (let r = 0; r < radial; r++) {
        const th = (r / radial) * Math.PI * 2;
        const v = c.clone().addScaledVector(side, Math.cos(th) * w).addScaledVector(Y, Math.sin(th) * beadH);
        pos.push(v.x, v.y, v.z);
        const nn = side.clone().multiplyScalar(Math.cos(th) * beadH).addScaledVector(Y, Math.sin(th) * w).normalize();
        nrm.push(nn.x, nn.y, nn.z);
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = base + i * radial, b = base + ((i + 1) % n) * radial;
      for (let r = 0; r < radial; r++) {
        const r2 = (r + 1) % radial;
        idx.push(a + r, b + r, a + r2, a + r2, b + r, b + r2);
      }
      segIndexEnd.push(idx.length);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const height = (layers - 1) * layerGap;
  geo.translate(0, -height / 2, 0);
  centers.forEach((c) => (c.y -= height / 2));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // Nozzle: a small cone that follows the deposition point.
  const nozzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.16, 20).rotateX(Math.PI),
    new THREE.MeshStandardMaterial({ color: o.nozzle, roughness: 0.35, metalness: 0.4 }),
  );
  scene.add(nozzle);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 0.8);
  rim.position.set(-3, 1, -2);
  scene.add(rim);

  const total = idx.length;
  const segCount = segIndexEnd.length;
  // Map a segment number to its starting center (skip seam rings for open paths).
  const segToCenter: number[] = [];
  {
    let ci = 0;
    for (let L = 0; L < layers; L++) {
      const n = isColumn ? 300 : centers.length / layers;
      const segs = closed ? n : n - 1;
      for (let i = 0; i < segs; i++) segToCenter.push(ci + i + 1 < ci + n ? ci + i + 1 : ci);
      ci += n;
    }
  }

  const update = (p: number, t: number) => {
    const seg = Math.max(1, Math.floor(p * segCount));
    geo.setDrawRange(0, seg >= segCount ? total : segIndexEnd[seg - 1]);
    const c = centers[segToCenter[Math.min(seg, segCount - 1)]];
    nozzle.position.set(c.x, c.y + 0.12, c.z);
    nozzle.visible = p < 0.999;

    if (isColumn) {
      const a = t * 0.12 + p * 1.4;
      const r = 6.4, el = 0.5 - p * 0.3;
      camera.position.set(Math.sin(a) * r, el * r * 0.5 + 0.3, Math.cos(a) * r);
      camera.lookAt(0, -0.1, 0);
    } else {
      const a = 0.6 + t * 0.06 + p * 0.5;
      camera.position.set(Math.sin(a) * 4.6, 3.3 - p * 0.8, Math.cos(a) * 4.6);
      camera.lookAt(0, 0, 0);
    }
  };

  return {
    scene, camera, update,
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
