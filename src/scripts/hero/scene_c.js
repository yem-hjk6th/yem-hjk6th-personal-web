// Hero candidate C, "One line, vault to column": the arc from architecture to fabrication as a single thread.
// A diagrid vault on four columns is drawn as ONE continuous line (members joined along the edge arches). The line
// lets go of the vault from its first member and winds onto the front column as that column's continuous spiral
// toolpath (slow - fast - slow, a speed ramp); the winding front is the nozzle (gold), the wound thread is the
// printed bead (grey). After a hold the thread unwinds, last wound first, and redraws the vault: the loop is seamless.
// The column profile r(z) comes from a real clay-column toolpath (AUT_eb8cn_ClassCode.src, E. Baharlou), scaled 2x;
// the vault is procedural. Nothing here is presented as measured data. Units: mm, Z up.
import { TAU, clamp, lerp, seg, E, Camera, fitCamera, glow, rgba, COL } from './v3d.js';

export const NAME = 'c';
export const DURATION = 18;
export const START = 2.4;            // first frame: the vault, the thread lets go 0.2 s later
export const STILL_T = 5.6;          // reduced motion: vault, thread in flight, the column begun
export const LABEL = 'Animated line drawing: a lattice vault drawn as one continuous line unwinds onto a column as its printing toolpath, then winds back into the vault.';

// clay column profile, 48 samples over its height (mm radius), from the .src spiral (see header)
const PROF = [50.22, 50.88, 51.9, 53.59, 56.08, 59.18, 62.89, 67.44, 72.49, 77.58, 82.72, 87.87, 92.46, 95.93, 98.44, 99.78, 99.83, 98.84, 96.89, 94.14, 91.03, 87.71, 84.12, 80.54, 77.24, 73.83, 70.66, 67.99, 65.65, 63.43, 61.44, 59.76, 58.21, 56.7, 55.34, 54.22, 53.18, 52.29, 51.59, 51.02, 50.52, 50.14, 49.88, 49.72, 49.63, 49.63, 49.71, 49.88];
const SC = 2, HC = 698 * SC;
const rCol = (z) => { const f = clamp(z / HC) * (PROF.length - 1), i = Math.min(PROF.length - 2, Math.floor(f)); return SC * lerp(PROF[i], PROF[i + 1], f - i); };

// ---- vault: square bay on four columns, edge arches, diagrid
const A = 1250, RISE = 330, REDGE = 520;
const vz = (x, y) => { const a = 1 - (x / A) ** 2, b = 1 - (y / A) ** 2; return HC + RISE * a * b + REDGE * (a + b) / 2; };
const COLS = [[A, A], [-A, A], [-A, -A], [A, -A]];
const FC = COLS[0];                     // the front column: the one the thread winds onto
const NM = 9;                           // members per direction
const N = 2600;                         // points on the thread
const NT = 18;                          // spiral turns on the column

// perimeter coordinate of a boundary point (square of side 2A, counter-clockwise from (-A,-A))
function perim(x, y) {
  const e = 1e-6;
  if (Math.abs(y + A) < e) return x + A;
  if (Math.abs(x - A) < e) return 2 * A + (y + A);
  if (Math.abs(y - A) < e) return 4 * A + (A - x);
  return 6 * A + (A - y);
}
function perimPt(p) {
  p = ((p % (8 * A)) + 8 * A) % (8 * A);
  if (p < 2 * A) return [p - A, -A];
  if (p < 4 * A) return [A, p - 3 * A];
  if (p < 6 * A) return [5 * A - p, A];
  return [-A, 7 * A - p];
}
function buildThread() {
  const path = [];
  const push = (x, y) => path.push([x, y, vz(x, y)]);
  let last = null;
  const walk = (x, y) => {   // along the boundary from `last` to (x, y), the short way
    if (!last) return;
    const p0 = perim(last[0], last[1]), p1 = perim(x, y);
    let d = p1 - p0; if (d > 4 * A) d -= 8 * A; if (d < -4 * A) d += 8 * A;
    const n = Math.max(2, Math.ceil(Math.abs(d) / 60));
    for (let i = 1; i < n; i++) { const q = perimPt(p0 + d * i / n); push(q[0], q[1]); }
  };
  for (let fam = 0; fam < 2; fam++) {
    for (let i = 0; i < NM; i++) {
      // orthogonal gridshell members (x = c, then y = c): never end-on to the camera
      const c = (-1 + (i + 1) / (NM + 1) * 2) * A;
      let a0 = -A, a1 = A;
      if ((i + fam) % 2) [a0, a1] = [a1, a0];
      const at = (v) => (fam ? [v, c] : [c, v]);
      walk(...at(a0));
      const n = Math.ceil(Math.abs(a1 - a0) / 40);
      for (let k = 0; k <= n; k++) { const q = at(lerp(a0, a1, k / n)); push(q[0], q[1]); }
      last = at(a1);
    }
  }
  return resample(path, N);
}
function resample(path, n) {
  const L = [0];
  for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]));
  const out = new Float32Array(n * 3), tot = L[L.length - 1];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = tot * k / (n - 1);
    while (j < L.length - 2 && L[j + 1] < s) j++;
    const f = (s - L[j]) / ((L[j + 1] - L[j]) || 1);
    for (let c = 0; c < 3; c++) out[3 * k + c] = lerp(path[j][c], path[j + 1][c], f);
  }
  return out;
}
const VAULT = buildThread();
// the column spiral, same number of points; starts on the side facing the vault centre
const TH0 = Math.atan2(-FC[1], -FC[0]);
const COLP = new Float32Array(N * 3), COLN = new Float32Array(N * 2);
for (let k = 0; k < N; k++) {
  const s = NT * k / (N - 1), z = HC * (0.015 + 0.97 * s / NT), th = TH0 + TAU * s, r = rCol(z) + 6;
  COLP[3 * k] = FC[0] + r * Math.cos(th); COLP[3 * k + 1] = FC[1] + r * Math.sin(th); COLP[3 * k + 2] = z;
  COLN[2 * k] = Math.cos(th); COLN[2 * k + 1] = Math.sin(th);
}

// ---- timeline: hold, wind (speed ramp), hold, unwind, hold
const T_W0 = 2.6, T_W1 = 9.8, FLY = 1.1;          // point k leaves the vault at tw(k), lands FLY later
const T_U0 = 12.4, T_U1 = 16.4, FLY2 = 1.0;       // unwinding: last wound first
const ramp = (u) => { u = clamp(u); return u - 0.8 * Math.sin(TAU * u) / TAU; };
function invRamp(y) { let u = y; for (let i = 0; i < 6; i++) u -= (ramp(u) - y) / (1 - 0.8 * Math.cos(TAU * u)); return clamp(u); }
const TW = new Float32Array(N), TU = new Float32Array(N);
for (let k = 0; k < N; k++) { TW[k] = T_W0 + (T_W1 - T_W0 - FLY) * invRamp(k / (N - 1)); TU[k] = T_U0 + (T_U1 - T_U0 - FLY2) * (1 - k / (N - 1)) ** 1.15; }
// 0 = on the vault, 1 = wound on the column
function state(k, t) {
  if (t < T_W0 || t >= T_U1 + 0.05) return 0;
  if (t < T_U0) return E.io2(seg(t, TW[k], TW[k] + FLY));
  return 1 - E.io2(seg(t, TU[k], TU[k] + FLY2));
}

// ---- camera
const cam = Camera();
let LW = 1;
const AZ0 = 0.66, EL0 = 0.34, DIST = 8200;
export function layout(L) {
  LW = L.dpr;
  const pv = [];
  for (const [x, y] of COLS) pv.push([x * 1.08, y * 1.08, 0], [x, y, HC]);
  for (const [x, y] of [[0, 0], [A, 0], [0, A], [-A, 0], [0, -A]]) pv.push([x, y, vz(x, y)]);
  cam.set(0, 0, HC * 0.62, AZ0, EL0, DIST);
  FV = fitCamera(cam, pv, L.focus, L.land ? 0.94 : 1.0, 0.5, L.land ? 0.55 : 0.6);
  // column framing: the wound column and the thread arriving over it
  const pc = [];
  for (let k = 0; k < 8; k++) { const a = TAU * k / 8; pc.push([FC[0] + 260 * Math.cos(a), FC[1] + 260 * Math.sin(a), 0], [FC[0] + 260 * Math.cos(a), FC[1] + 260 * Math.sin(a), HC + 420]); }
  cam.set(FC[0] * 0.8, FC[1] * 0.8, HC * 0.55, AZ0, EL0, DIST * 0.7);
  FCm = fitCamera(cam, pc, L.focus, L.land ? 0.84 : 0.88, 0.5, 0.5);
}
let FV = null, FCm = null;
function setCam(t) {
  // move in once most of the vault has gone; move out as soon as the thread starts back, so the vault is seen re-forming
  const k = t < 11 ? E.io3(seg(t, T_W0 + 3.6, T_W1 + 0.6)) : 1 - E.io3(seg(t, T_U0 - 0.4, T_U0 + 2.6));
  const az = AZ0 + 0.16 * Math.sin(TAU * t / DURATION), el = EL0 + 0.025 * Math.sin(TAU * t / DURATION + 1.1);
  cam.set(lerp(0, FC[0] * 0.8, k), lerp(0, FC[1] * 0.8, k), lerp(HC * 0.62, HC * 0.55, k), az, el, lerp(DIST, DIST * 0.7, k));
  cam.F = Math.exp(lerp(Math.log(FV.F), Math.log(FCm.F), k)); cam.cx = lerp(FV.cx, FCm.cx, k); cam.cy = lerp(FV.cy, FCm.cy, k);
  return lerp(DIST, DIST * 0.7, k);
}

const SX = new Float32Array(N), SY = new Float32Array(N), SU = new Float32Array(N), SL = new Uint8Array(N);
const BV = Array.from({ length: 6 }, () => []), BW = Array.from({ length: 7 }, () => []), BG = Array.from({ length: 5 }, () => []);
export function render(g, t, L) {
  t = ((t % DURATION) + DURATION) % DURATION;
  const w = LW;
  const cd = setCam(t);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const d0 = cd - 2600, d1 = cd + 2600;
  const fog = (d) => clamp(1 - (d - d0) / (d1 - d0) * 0.7, 0.3, 1);

  drawPlan(g, w);
  for (let c = 1; c < 4; c++) drawColumn(g, COLS[c][0], COLS[c][1], w, 1, false);

  // ---- thread: project every point at its state
  let head = -1, flying = 0;
  const lx = -0.35, ly = 0.94;   // light for the wound bead (world, horizontal)
  for (let k = 0; k < N; k++) {
    const u = state(k, t);
    const vx = VAULT[3 * k], vy = VAULT[3 * k + 1], vzz = VAULT[3 * k + 2];
    let x, y, z;
    if (u <= 0) { x = vx; y = vy; z = vzz; }
    else if (u >= 1) { x = COLP[3 * k]; y = COLP[3 * k + 1]; z = COLP[3 * k + 2]; }
    else {
      const cx = COLP[3 * k], cy = COLP[3 * k + 1], cz = COLP[3 * k + 2];
      x = lerp(vx, cx, u); y = lerp(vy, cy, u); z = lerp(vzz, cz, u) + Math.sin(Math.PI * u) * 260;
      flying++;
    }
    cam.p(x, y, z); SX[k] = cam.X; SY[k] = cam.Y; SU[k] = u;
    if (u >= 1) {
      const nx = COLN[2 * k], ny = COLN[2 * k + 1];
      if (!cam.faces(x, y, z, nx, ny, 0)) SL[k] = 0;
      else SL[k] = 1 + Math.min(5, Math.floor(clamp(0.15 + 0.85 * Math.max(0, nx * lx + ny * ly)) * 6));
      if (t < T_U0) head = k;
    } else SL[k] = 1 + Math.min(4, Math.floor(fog(cam.D) * 5));
  }
  // the wound column has a planned outline until the thread covers it
  const woundShare = head >= 0 ? head / (N - 1) : 0;
  const plannedA = t < T_U0 ? 1 - seg(t, T_W0 + 0.5, T_W0 + 2.5) : seg(t, T_U1 - 1.0, T_U1);
  if (plannedA > 0.01) drawColumn(g, FC[0], FC[1], w, plannedA, true);

  for (const b of BV) b.length = 0; for (const b of BW) b.length = 0; for (const b of BG) b.length = 0;
  for (let k = 0; k < N - 1; k++) {
    const a = SU[k], b = SU[k + 1];
    if (a <= 0 && b <= 0) BV[Math.min(SL[k], SL[k + 1])].push(SX[k], SY[k], SX[k + 1], SY[k + 1]);
    else if (a >= 1 && b >= 1) BW[Math.min(SL[k], SL[k + 1])].push(SX[k], SY[k], SX[k + 1], SY[k + 1]);
    else { const m = Math.max(a, b); BG[Math.min(4, Math.floor(Math.sin(Math.PI * clamp(m)) * 4.99))].push(SX[k], SY[k], SX[k + 1], SY[k + 1]); }
  }
  const stroke = (arr, css, lw) => {
    if (!arr.length) return;
    g.strokeStyle = css; g.lineWidth = lw; g.beginPath();
    let lx2 = NaN, ly2 = NaN;
    for (let i = 0; i < arr.length; i += 4) { if (arr[i] !== lx2 || arr[i + 1] !== ly2) g.moveTo(arr[i], arr[i + 1]); g.lineTo(arr[i + 2], arr[i + 3]); lx2 = arr[i + 2]; ly2 = arr[i + 3]; }
    g.stroke();
  };
  // vault (grey, depth-faded), wound bead (shaded grey, hidden side faint), thread in flight (gold)
  for (let k = 1; k < 6; k++) stroke(BV[k], rgba('#D0D0D0', 0.16 + 0.13 * k), 0.85 * w);
  stroke(BW[0], rgba('#FFFFFF', 0.07), 0.7 * w);
  for (let k = 1; k < 7; k++) { const v = (k - 0.5) / 6; stroke(BW[k], `rgba(${Math.round(150 + 92 * v)},${Math.round(150 + 92 * v)},${Math.round(150 + 92 * v)},${0.3 + 0.65 * v})`, 1.25 * w); }
  for (let k = 0; k < 5; k++) stroke(BG[k], rgba(COL.gold, 0.35 + 0.15 * k), (1.0 + 0.15 * k) * w);

  // winding front: gold light where the thread lands (the nozzle)
  if (head >= 0 && head < N - 1 && flying > 0) {
    const rr = 20 * w;
    g.globalCompositeOperation = 'lighter'; g.drawImage(glow(COL.gold), SX[head] - rr, SY[head] - rr, 2 * rr, 2 * rr); g.globalCompositeOperation = 'source-over';
  }
}

function drawColumn(g, x0, y0, w, a, planned) {
  // silhouette from the profile at the two tangent azimuths, plus section rings
  const va = Math.atan2(cam.ey - y0, cam.ex - x0);
  if (planned) g.setLineDash([5 * w, 5 * w]);
  g.strokeStyle = rgba(COL.ink, (planned ? 0.4 : 0.55) * a); g.lineWidth = 0.85 * w;
  for (const side of [-1, 1]) {
    const th = va + side * Math.PI / 2;
    g.beginPath();
    for (let i = 0; i <= 28; i++) { const z = HC * i / 28, r = rCol(z); cam.p(x0 + r * Math.cos(th), y0 + r * Math.sin(th), z); i ? g.lineTo(cam.X, cam.Y) : g.moveTo(cam.X, cam.Y); }
    g.stroke();
  }
  g.strokeStyle = rgba(COL.ink, (planned ? 0.25 : 0.22) * a); g.lineWidth = 0.65 * w;
  for (const u of planned ? [0, 1] : [0, 0.25, 0.5, 0.75, 1]) {
    const z = HC * u, r = rCol(z);
    g.beginPath();
    for (let i = 0; i <= 36; i++) { const q = TAU * i / 36; cam.p(x0 + r * Math.cos(q), y0 + r * Math.sin(q), z); i ? g.lineTo(cam.X, cam.Y) : g.moveTo(cam.X, cam.Y); }
    g.stroke();
  }
  g.setLineDash([]);
}

function drawPlan(g, w) {
  // column axes (dash-dot) with bubbles, and the slab edge: the architect's ground
  g.setLineDash([16 * w, 5 * w, 2 * w, 5 * w]); g.lineWidth = 0.6 * w; g.strokeStyle = rgba(COL.ink, 0.17);
  g.beginPath();
  const R = A * 2.0;
  for (const v of [-A, A]) {
    cam.p(v, -R, 0); g.moveTo(cam.X, cam.Y); cam.p(v, R, 0); g.lineTo(cam.X, cam.Y);
    cam.p(-R, v, 0); g.moveTo(cam.X, cam.Y); cam.p(R, v, 0); g.lineTo(cam.X, cam.Y);
  }
  g.stroke(); g.setLineDash([]);
  g.strokeStyle = rgba(COL.ink, 0.2); g.beginPath();
  for (const v of [-A, A]) for (const [x, y] of [[v, -R - 110], [v, R + 110], [-R - 110, v], [R + 110, v]]) {
    for (let i = 0; i <= 28; i++) { const q = TAU * i / 28; cam.p(x + 110 * Math.cos(q), y + 110 * Math.sin(q), 0); i ? g.lineTo(cam.X, cam.Y) : g.moveTo(cam.X, cam.Y); }
  }
  g.stroke();
  g.strokeStyle = rgba(COL.ink, 0.1); g.beginPath();
  [[-1.45, -1.45], [1.45, -1.45], [1.45, 1.45], [-1.45, 1.45]].forEach(([a, b], i) => { cam.p(a * A, b * A, 0); i ? g.lineTo(cam.X, cam.Y) : g.moveTo(cam.X, cam.Y); });
  g.closePath(); g.stroke();
}
