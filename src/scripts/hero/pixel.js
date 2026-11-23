// Pixel raster for the home-page hero: whole-pixel primitives on a low-res RGBA buffer.
// Ported from cth9191/animate v0.4.0 (MIT, (c) 2026 cth9191) pixel kit: same primitive names and
// semantics (pset, prect, pline, pellipse, ppoly, sprite, pixText), rewritten to write straight into
// a Uint32Array so a frame costs well under a millisecond. Colours are packed ints from rgb('#hex').

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const EZ = {
  o2: (t) => 1 - (1 - clamp(t)) ** 2,
  o3: (t) => 1 - (1 - clamp(t)) ** 3,
  i2: (t) => clamp(t) ** 2,
  io: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; },
};

// little-endian RGBA in a Uint32Array: 0xAABBGGRR
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(...xs) {
  let h = 2166136261;
  for (const x of xs) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 124; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function RNG(...xs) {
  const f = mulberry32(hash(...xs));
  return { f, i: (a, b) => a + Math.floor(f() * (b - a + 1)), r: (a, b) => a + (b - a) * f() };
}

// ---- raster state: the target buffer, a whole-number zoom/offset (canvas = z * p + t) and a clip rect
const R = { buf: null, W: 0, H: 0, z: 1, tx: 0, ty: 0, cx0: 0, cy0: 0, cx1: 0, cy1: 0 };
export function target(buf, W, H) { Object.assign(R, { buf, W, H, z: 1, tx: 0, ty: 0, cx0: 0, cy0: 0, cx1: W, cy1: H }); }
export function clear() { R.buf.fill(0); }
// run fn with pixel coords mapped through zoom z and offset (tx, ty), optionally clipped to a canvas rect
export function zoomed(z, tx, ty, fn, clip) {
  const k = { z: R.z, tx: R.tx, ty: R.ty, cx0: R.cx0, cy0: R.cy0, cx1: R.cx1, cy1: R.cy1 };
  R.z = R.z * z; R.tx = k.tx + k.z * tx; R.ty = k.ty + k.z * ty;
  if (clip) { R.cx0 = Math.max(k.cx0, clip[0]); R.cy0 = Math.max(k.cy0, clip[1]); R.cx1 = Math.min(k.cx1, clip[0] + clip[2]); R.cy1 = Math.min(k.cy1, clip[1] + clip[3]); }
  try { fn(); } finally { Object.assign(R, k); }
}

function cellR(x, y, w, h, c) {
  const z = R.z;
  let x0 = z * x + R.tx, y0 = z * y + R.ty, x1 = x0 + z * w, y1 = y0 + z * h;
  if (x0 < R.cx0) x0 = R.cx0; if (y0 < R.cy0) y0 = R.cy0; if (x1 > R.cx1) x1 = R.cx1; if (y1 > R.cy1) y1 = R.cy1;
  if (x1 <= x0 || y1 <= y0) return;
  const b = R.buf, W = R.W;
  for (let j = y0; j < y1; j++) b.fill(c, j * W + x0, j * W + x1);
}
export function pset(x, y, c) { cellR(Math.round(x), Math.round(y), 1, 1, c); }
export function prect(x, y, w, h, c) { cellR(Math.round(x), Math.round(y), Math.round(w), Math.round(h), c); }
export function pline(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 4096; n++) {
    cellR(x0, y0, 1, 1, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
// marching dotted line: every third pixel, phase ph
export function dline(x0, y0, x1, y1, c, ph) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 4096; n++) {
    if ((n + ph) % 3 === 0) cellR(x0, y0, 1, 1, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
export function pellipse(cx, cy, rx, ry, c, o = {}) {
  cx = Math.round(cx); cy = Math.round(cy); rx = Math.max(0, Math.round(rx)); ry = Math.max(0, Math.round(ry));
  const A = rx + 0.5, Bq = ry + 0.5, t = o.ring ?? 0;
  for (let j = -ry; j <= ry; j++) {
    const hw = Math.floor(A * Math.sqrt(Math.max(0, 1 - (j / Bq) ** 2)) + 1e-9);
    if (!t) { cellR(cx - hw, cy + j, 2 * hw + 1, 1, c); continue; }
    const iA = A - t, iB = Bq - t, inner = iA > 0 && iB > 0 && Math.abs(j) < iB ? Math.floor(iA * Math.sqrt(Math.max(0, 1 - (j / iB) ** 2)) + 1e-9) : -1;
    if (inner < 0) cellR(cx - hw, cy + j, 2 * hw + 1, 1, c);
    else { cellR(cx - hw, cy + j, hw - inner, 1, c); cellR(cx + inner + 1, cy + j, hw - inner, 1, c); }
  }
}
export const pcircle = (cx, cy, r, c, o) => pellipse(cx, cy, r, r, c, o);
export function ppoly(P, c) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of P) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  y0 = Math.floor(y0); y1 = Math.ceil(y1) + 1;
  const n = P.length;
  for (let j = y0; j < y1; j++) {
    const yc = j + 0.5, xs = [];
    for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n]; if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.ceil(xs[k] - 0.5), i1 = Math.ceil(xs[k + 1] - 0.5); if (i1 > i0) cellR(i0, j, i1 - i0, 1, c); }
  }
}
// sprites from string rows; map { a: colour, b: colour }; '.' is clear
export function sprite(rows, map, x, y) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length;) {
      const ch = row[i]; let k = i + 1;
      while (k < row.length && row[k] === ch) k++;
      const col = map[ch];
      if (col !== undefined) cellR(x + i, y + j, k - i, 1, col);
      i = k;
    }
  }
}

// 5x7 bitmap font (from the animate kit), upper case only
const FONT5 = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12], '-': [0, 0, 0, 31, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12],
};
export const textW = (s) => Math.max(0, String(s).length * 6 - 1);
export function pixText(str, x, y, c, o = {}) {
  const s = String(str).toUpperCase(), tw = textW(s);
  const x0 = Math.round(x - (o.align === 'center' ? Math.floor(tw / 2) : o.align === 'right' ? tw : 0)), y0 = Math.round(y);
  for (let k = 0; k < s.length; k++) {
    const gl = FONT5[s[k]] || FONT5[' '];
    for (let r = 0; r < 7; r++) {
      const bits = gl[r]; if (!bits) continue;
      for (let b = 0; b < 5; b++) {
        if (!(bits & (16 >> b))) continue;
        let e = b; while (e + 1 < 5 && bits & (16 >> (e + 1))) e++;
        cellR(x0 + k * 6 + b, y0 + r, e - b + 1, 1, c); b = e;
      }
    }
  }
  return tw;
}

// Cap the brightness where text sits on top: m[i] (0..255) is the highest channel value allowed there.
// Brighter pixels are scaled down with their hue kept; pixels already darker than the cap stay as they are,
// so the dark backgrounds show no box. idx lists the affected pixels so the pass only visits them.
export function applyMask(buf, idx, m) {
  for (let n = 0; n < idx.length; n++) {
    const i = idx[n], v = buf[i];
    if (!(v >>> 24)) continue;
    const r = v & 0xff, g = (v >>> 8) & 0xff, b = (v >>> 16) & 0xff, mx = r > g ? (r > b ? r : b) : (g > b ? g : b), cap = m[n];
    if (mx <= cap) continue;
    buf[i] = (v & 0xff000000) | (((b * cap / mx) | 0) << 16) | (((g * cap / mx) | 0) << 8) | ((r * cap / mx) | 0);
  }
}
