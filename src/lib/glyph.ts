// Procedural placeholder artwork for projects (no images exist yet).
// Each project gets a deterministic SVG drawing seeded by its slug, in a
// motif that hints at the work: toolpaths, contours, point clouds, grids.

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const f = (n: number) => n.toFixed(1);

export type Motif = 'raster' | 'graph' | 'hilbert' | 'contour' | 'spiral' | 'arcs' | 'plan' | 'cloud' | 'warp';

const bySlug: Record<string, Motif> = {
  'vision-guided-pellet-extrusion': 'raster',
  'rsi-proj-ros': 'graph',
  'mycelium-mineral-panels': 'hilbert',
  'living-column': 'contour',
  'clay-paste-extruder': 'spiral',
  'wood-hygroscopic-ml': 'arcs',
  'hsr-station-competitions': 'plan',
  'cs6501-3dcv-pointcloud-robustness': 'cloud',
  'cs6501-fourier-net-registration': 'warp',
};
const all: Motif[] = ['raster', 'graph', 'hilbert', 'contour', 'spiral', 'arcs', 'plan', 'cloud', 'warp'];

function hilbert(order: number, size: number, pad: number) {
  const n = 2 ** order;
  const pts: [number, number][] = [];
  for (let d = 0; d < n * n; d++) {
    let x = 0, y = 0, t = d;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t / 2), ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
        [x, y] = [y, x];
      }
      x += s * rx; y += s * ry; t = Math.floor(t / 4);
    }
    const step = (size - 2 * pad) / (n - 1);
    pts.push([pad + x * step, pad + y * step]);
  }
  return pts;
}

/** Returns inner SVG markup for a 0 0 W H viewBox. Strokes use currentColor. */
export function glyph(slug: string, W = 400, H = 300): { motif: Motif; svg: string } {
  const motif = bySlug[slug] ?? all[hash(slug) % all.length];
  const r = rng(hash(slug));
  const out: string[] = [];
  const path = (d: string, w = 1.6, o = 1) =>
    out.push(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`);

  switch (motif) {
    case 'raster': {
      // Zig-zag infill whose bead swells at the turns, as it does when the robot slows at corners.
      const rows = 11, x0 = 50, x1 = W - 50;
      for (let i = 0; i < rows; i++) {
        const y = 40 + i * ((H - 80) / (rows - 1));
        path(`M${x0} ${f(y)} H${x1}`, 3, 0.85);
        const cx = i % 2 ? x0 : x1;
        out.push(`<circle cx="${cx}" cy="${f(y)}" r="${f(4 + r() * 2.5)}" fill="currentColor" opacity="0.9"/>`);
      }
      break;
    }
    case 'graph': {
      const nodes = Array.from({ length: 7 }, (_, i) => [60 + (i % 4) * 95 + r() * 20, 70 + Math.floor(i / 4) * 140 + r() * 30]);
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++)
          if (r() < 0.35 || j === i + 1) path(`M${f(nodes[i][0])} ${f(nodes[i][1])} L${f(nodes[j][0])} ${f(nodes[j][1])}`, 1.2, 0.6);
      nodes.forEach(([x, y]) => out.push(`<rect x="${f(x - 9)}" y="${f(y - 9)}" width="18" height="18" rx="3" fill="currentColor"/>`));
      break;
    }
    case 'hilbert': {
      const pts = hilbert(4, H, 30).map(([x, y]) => [x + (W - H) / 2, y]);
      path('M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L'), 3.2, 0.9);
      break;
    }
    case 'contour': {
      for (let i = 0; i < 9; i++) {
        const rx = 30 + i * 15, ry = 22 + i * 12, wob = 2 + r() * 4;
        const pts = Array.from({ length: 49 }, (_, k) => {
          const a = (k / 48) * Math.PI * 2;
          const m = 1 + (Math.sin(a * 6 + i) * wob) / 100;
          return `${f(W / 2 + Math.cos(a) * rx * m)} ${f(H / 2 + Math.sin(a) * ry * m)}`;
        });
        path('M' + pts.join(' L') + 'Z', 2, 0.35 + i * 0.07);
      }
      break;
    }
    case 'spiral': {
      const pts: string[] = [];
      for (let a = 0; a < Math.PI * 14; a += 0.08) {
        const rr = 6 + a * 2.6;
        pts.push(`${f(W / 2 + Math.cos(a) * rr * 1.25)} ${f(H / 2 + Math.sin(a) * rr)}`);
      }
      path('M' + pts.join(' L'), 2.4, 0.85);
      break;
    }
    case 'arcs': {
      // Bilayer strips bending by different amounts.
      for (let i = 0; i < 6; i++) {
        const y = 60 + i * 36, k = 10 + i * 14 + r() * 8;
        path(`M60 ${y} Q${W / 2} ${f(y - k)} ${W - 60} ${y}`, 5, 0.25);
        path(`M60 ${y + 6} Q${W / 2} ${f(y + 6 - k)} ${W - 60} ${y + 6}`, 2, 0.9);
      }
      break;
    }
    case 'plan': {
      // Platform and track lines with a long canopy.
      for (let i = 0; i < 8; i++) path(`M30 ${60 + i * 26} H${W - 30}`, i % 3 === 0 ? 2.4 : 1, i % 3 === 0 ? 0.9 : 0.45);
      out.push(`<rect x="110" y="96" width="${W - 220}" height="96" rx="48" fill="none" stroke="currentColor" stroke-width="3"/>`);
      for (let x = 130; x < W - 120; x += 24) path(`M${x} 100 V188`, 1, 0.5);
      break;
    }
    case 'cloud': {
      // A sampled shape with a missing patch.
      for (let i = 0; i < 420; i++) {
        const a = r() * Math.PI * 2, b = Math.acos(2 * r() - 1);
        const x = Math.sin(b) * Math.cos(a), y = Math.cos(b), z = Math.sin(b) * Math.sin(a);
        if (x > 0.35 && y > -0.2) continue;
        const s = 1 / (2.4 - z);
        out.push(`<circle cx="${f(W / 2 + x * 230 * s)}" cy="${f(H / 2 + y * 230 * s)}" r="${f(1.4 + z * 0.8)}" fill="currentColor" opacity="${(0.45 + z * 0.4).toFixed(2)}"/>`);
      }
      break;
    }
    case 'warp': {
      const n = 12, warp = (x: number, y: number) => {
        const dx = x - W / 2, dy = y - H / 2, d = Math.exp(-(dx * dx + dy * dy) / 9000);
        return [x + dy * 0.35 * d, y - dx * 0.35 * d];
      };
      for (let i = 0; i <= n; i++) {
        const row: string[] = [], col: string[] = [];
        for (let j = 0; j <= 40; j++) {
          const [ax, ay] = warp(40 + (j / 40) * (W - 80), 30 + (i / n) * (H - 60));
          const [bx, by] = warp(40 + (i / n) * (W - 80), 30 + (j / 40) * (H - 60));
          row.push(`${f(ax)} ${f(ay)}`); col.push(`${f(bx)} ${f(by)}`);
        }
        path('M' + row.join(' L'), 1.1, 0.7); path('M' + col.join(' L'), 1.1, 0.7);
      }
      break;
    }
  }
  return { motif, svg: out.join('') };
}
