// Shared helpers for the vector hero candidates (W21): easing, seeded RNG, a perspective camera,
// convex hull, and a cached glow sprite. Plain Canvas2D, no dependencies.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));          // 0..1 progress of t through [a, b]
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const E = {
  out2: (t) => 1 - (1 - clamp(t)) ** 2,
  out3: (t) => 1 - (1 - clamp(t)) ** 3,
  out5: (t) => 1 - (1 - clamp(t)) ** 5,
  in2: (t) => clamp(t) ** 2,
  in3: (t) => clamp(t) ** 3,
  io2: (t) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; },
  io3: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; },
  ioS: (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t)),
  outBack: (t, k = 1.2) => { t = clamp(t) - 1; return 1 + (k + 1) * t * t * t + k * t * t; },
};
// periodic distance: shortest signed difference a - b on a circle of length p
export const pmod = (x, p) => ((x % p) + p) % p;

export function RNG(seed) {
  let a = seed >>> 0;
  const f = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { f, r: (lo, hi) => lo + (hi - lo) * f(), n: () => { const u = f() || 1e-9, v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); } };
}

// Perspective camera, world Z up. set() places the eye on a sphere around the target (az around Z from +Y towards +X,
// el above the ground). p(x, y, z) writes screen x/y (device px), depth (along the view axis) and scale (px per world unit).
export function Camera() {
  const c = {
    ex: 0, ey: 0, ez: 0, rx: 0, ry: 0, rz: 0, ux: 0, uy: 0, uz: 0, fx: 0, fy: 0, fz: 0,
    F: 1, cx: 0, cy: 0, X: 0, Y: 0, D: 1, S: 1,
    set(tx, ty, tz, az, el, dist) {
      const ce = Math.cos(el);
      c.ex = tx + dist * ce * Math.sin(az); c.ey = ty + dist * ce * Math.cos(az); c.ez = tz + dist * Math.sin(el);
      let fx = tx - c.ex, fy = ty - c.ey, fz = tz - c.ez; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      let rx = fy, ry = -fx, rz = 0; const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl;      // right = f x Z
      c.fx = fx; c.fy = fy; c.fz = fz; c.rx = rx; c.ry = ry; c.rz = rz;
      c.ux = ry * fz - rz * fy; c.uy = rz * fx - rx * fz; c.uz = rx * fy - ry * fx;               // up = r x f
      return c;
    },
    p(x, y, z) {
      const dx = x - c.ex, dy = y - c.ey, dz = z - c.ez;
      const d = dx * c.fx + dy * c.fy + dz * c.fz;
      const s = c.F / d;
      c.X = c.cx + (dx * c.rx + dy * c.ry + dz * c.rz) * s;
      c.Y = c.cy - (dx * c.ux + dy * c.uy + dz * c.uz) * s;
      c.D = d; c.S = s;
      return c;
    },
    // is the outward normal (nx, ny, nz) at (x, y, z) facing the eye?
    faces(x, y, z, nx, ny, nz) { return (c.ex - x) * nx + (c.ey - y) * ny + (c.ez - z) * nz > 0; },
  };
  return c;
}

// Fit: given a camera already set with F = 1, cx = cy = 0, and a list of world points, choose F, cx, cy so the
// projected box fills rect (x0, y0, x1, y1) by `fill` (0..1), anchored at (ax, ay) in 0..1 of the rect.
export function fitCamera(cam, pts, rect, fill = 0.9, ax = 0.5, ay = 0.5) {
  cam.F = 1; cam.cx = 0; cam.cy = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of pts) { cam.p(q[0], q[1], q[2]); x0 = Math.min(x0, cam.X); x1 = Math.max(x1, cam.X); y0 = Math.min(y0, cam.Y); y1 = Math.max(y1, cam.Y); }
  const rw = rect.x1 - rect.x0, rh = rect.y1 - rect.y0;
  const F = fill * Math.min(rw / (x1 - x0), rh / (y1 - y0));
  cam.F = F;
  cam.cx = rect.x0 + (rw - (x1 - x0) * F) * ax - x0 * F;
  cam.cy = rect.y0 + (rh - (y1 - y0) * F) * ay - y0 * F;
  return { F, cx: cam.cx, cy: cam.cy };
}

// Monotone-chain convex hull of a flat [x0, y0, x1, y1, ...] array; returns a flat array.
export function hull(a, n) {
  const idx = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[2 * i] - a[2 * j] || a[2 * i + 1] - a[2 * j + 1]);
  const cr = (o, p, q) => (a[2 * p] - a[2 * o]) * (a[2 * q + 1] - a[2 * o + 1]) - (a[2 * p + 1] - a[2 * o + 1]) * (a[2 * q] - a[2 * o]);
  const lo = [], up = [];
  for (const i of idx) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], i) <= 0) lo.pop(); lo.push(i); }
  for (let k = idx.length - 1; k >= 0; k--) { const i = idx[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], i) <= 0) up.pop(); up.push(i); }
  lo.pop(); up.pop();
  const out = [];
  for (const i of lo.concat(up)) out.push(a[2 * i], a[2 * i + 1]);
  return out;
}

// A soft round glow sprite (radial gradient), cached per colour; draw with globalCompositeOperation 'lighter'.
const glowCache = new Map();
export function glow(hex) {
  if (glowCache.has(hex)) return glowCache.get(hex);
  const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  gr.addColorStop(0, `rgba(${r},${gg},${b},0.9)`); gr.addColorStop(0.25, `rgba(${r},${gg},${b},0.35)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  glowCache.set(hex, cv);
  return cv;
}

export const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
export const COL = { gold: '#F2C14E', blue: '#A3C8FF', white: '#F2F2F2', grey: '#BDBDBD', ink: '#E6E6E6' };
