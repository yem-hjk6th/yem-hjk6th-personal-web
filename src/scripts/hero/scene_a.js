// Hero candidate A, "Drawn in light": a fine-line perspective drawing of a robot cell. An abstract six-axis arm on a
// floor rail prints a non-planar shell as one continuous spiral (gold while it is being made, settling to grey); a
// stereo pair on a gantry sweeps its frustum over the work and blue points settle onto the fresh layers; white ticks
// mark the few spots where the scan departs from the plan. When a shell is done the sensor uploads its scan, a small
// window compares the model (grey solid) with the scan (blue) as a deviation chart (white) and a correction (gold), the
// correction travels to a chip on the robot ("received"), and the carriage moves one bay: finished shells recede into
// a colonnade and the loop has no reset (Ye, 2026-11-22 21:15: callout, pop-up, data visualisation, message, no seam).
// Geometry is procedural (no robot meshes, no measured data). World units are millimetres, Z up.
import { TAU, clamp, lerp, seg, smooth, E, RNG, Camera, fitCamera, hull, glow, rgba, COL } from './v3d.js';

export const NAME = 'a';
export const DURATION = 20;          // one shell per loop: print 12.4 s, compare and message 4.6 s, move 3 s
export const START = 4.5;            // first frame: mid-print
export const STILL_T = 9.0;
export const LABEL = 'Animated line drawing: a robot arm on a rail prints a row of curved shells while a stereo camera scans each fresh layer.';

const S = 600;            // bay spacing along the rail (multiple of the 200 mm grid, so the loop seam is exact)
const N = 14;             // spiral turns per shell
const HP = 460;           // shell height
const TP = 12.4;          // print time
const YR = -760;          // rail centre line
const K = 64;             // samples per turn
const BAYS = 7;           // finished shells drawn behind the current one
const BY = 330, BZ = 1180, BD = 90;                    // overhead truss in front of the work (y, top chord z, depth)
const RX = 150, RZ = 900;                              // stereo trolley: offset along the truss, height of the stereo bar
const TH0 = -Math.PI / 2; // spiral starts on the rail side
// after-print beat (s): upload callout, compare window, message to the robot's chip, then the carriage moves one bay
const B_UP0 = 12.7, B_WIN0 = 13.45, B_SCAN0 = 13.75, B_CMP0 = 14.6, B_COR0 = 15.25, B_PK0 = 15.95, B_PK1 = 16.75;
const B_WCL0 = 16.35, B_WCL1 = 16.75, B_RX1 = 18.4;
const MV0 = 17.0, MV1 = DURATION - 0.55;

// ---- shell: one spiral, a lobed and slightly twisted section, a non-planar wave that grows towards the rim
const Rr = (u) => 132 + 30 * Math.sin(Math.PI * u) - 30 * u;
function shellPt(s, cx, o) {
  const u = s / N, th = TH0 + TAU * s;
  const r = Rr(u) * (1 + 0.055 * Math.cos(5 * th + 1.4 * u));
  o[0] = cx + r * Math.cos(th); o[1] = r * Math.sin(th);
  o[2] = (HP / N) * s + 34 * u * u * Math.sin(2 * th + 0.7);
  o[3] = Math.cos(th); o[4] = Math.sin(th);
  return o;
}
// spiral progress over the print: soft start, constant feed
const V = N / (TP - 0.25);
const sAt = (t) => (t <= 0 ? 0 : t < 0.5 ? V * t * t : t < TP ? Math.min(N, V * (t - 0.25)) : N);
const tAt = (s) => (s <= V * 0.25 ? Math.sqrt(s / V) : s / V + 0.25);   // inverse of sAt

// ---- precomputed shell samples and scan points (relative to the shell centre)
const NS = N * K + 1;
const SH = new Float32Array(NS * 5);
{ const o = [0, 0, 0, 0, 0]; for (let i = 0; i < NS; i++) { shellPt(i / K, 0, o); SH.set(o, i * 5); } }
const NP = 300;
const PTS = [];   // { x, y, z, ta, nx, ny, nz, d } scan points, ta = appear time in the shell's own clock
const TICKS = []; // deviation marks
{
  const rng = RNG(7);
  const o = [0, 0, 0, 0, 0];
  const RIG = [0.42, 0.91];   // horizontal direction from the shell towards the scanner (front, on the truss)
  while (PTS.length < NP) {
    const s = rng.r(0.15, N);
    shellPt(s, 0, o);
    const f = o[3] * RIG[0] + o[4] * RIG[1];
    if (f < 0.05 + rng.f() * 0.25) continue;
    const bead = 5;
    PTS.push({ x: o[0] + o[3] * bead, y: o[1] + o[4] * bead, z: o[2] + rng.r(-4, 4), ta: tAt(s) + 0.9 + rng.r(0, 0.6), dn: rng.n() * 46, sz: rng.r(0.8, 1.25) });
  }
  for (const s of [4.62, 8.38, 11.55]) { shellPt(s, 0, o); TICKS.push({ x: o[0], y: o[1], z: o[2], nx: o[3], ny: o[4], ta: tAt(s) + 1.3, s }); }
}

// ---- arm (abstract six-axis, line drawing): base on the carriage, shoulder, elbow, spherical wrist, extruder
const ARM = { h1: 340, a1: 60, L2: 580, L3: 560, Lw: 95, Lt: 190 };
function ik(bx, by, bz, px, py, pz, ux, uy, uz) {
  const L = ARM.Lt + ARM.Lw;
  const wx = px - ux * L, wy = py - uy * L, wz = pz - uz * L;
  let dx = wx - bx, dy = wy - by; const hd = Math.hypot(dx, dy) || 1; dx /= hd; dy /= hd;
  const sx = bx + dx * ARM.a1, sy = by + dy * ARM.a1, sz = bz + ARM.h1;
  const rho = hd - ARM.a1, h = wz - sz;
  const D = Math.min(Math.hypot(rho, h), ARM.L2 + ARM.L3 - 1);
  const al = Math.atan2(h, rho) + Math.acos(clamp((ARM.L2 ** 2 + D * D - ARM.L3 ** 2) / (2 * ARM.L2 * D), -1, 1));
  const ex = sx + dx * ARM.L2 * Math.cos(al), ey = sy + dy * ARM.L2 * Math.cos(al), ez = sz + ARM.L2 * Math.sin(al);
  const fx = wx + ux * ARM.Lw, fy = wy + uy * ARM.Lw, fz = wz + uz * ARM.Lw;
  return { B: [bx, by, bz], S: [sx, sy, sz], E: [ex, ey, ez], W: [wx, wy, wz], F: [fx, fy, fz], P: [px, py, pz], n: [-dy, dx, 0], d: [dx, dy, 0] };
}

// ---- cylinder / box primitives drawn with black fill (hidden-line removal by painter's order) and ink outlines
const CI = 20, CO = [], SI = [];
for (let i = 0; i < CI; i++) { CO.push(Math.cos(TAU * i / CI)); SI.push(Math.sin(TAU * i / CI)); }
const capA = new Float64Array(CI * 2), capB = new Float64Array(CI * 2), both = new Float64Array(CI * 4);
function cylinder(cam, P0, P1, r0, r1) {
  let ax = P1[0] - P0[0], ay = P1[1] - P0[1], az = P1[2] - P0[2]; const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
  let hx = 0, hy = 0, hz = 1; if (Math.abs(az) > 0.9) { hx = 1; hz = 0; }
  let e1x = ay * hz - az * hy, e1y = az * hx - ax * hz, e1z = ax * hy - ay * hx; const l1 = Math.hypot(e1x, e1y, e1z); e1x /= l1; e1y /= l1; e1z /= l1;
  const e2x = ay * e1z - az * e1y, e2y = az * e1x - ax * e1z, e2z = ax * e1y - ay * e1x;
  for (let i = 0; i < CI; i++) {
    const cx = e1x * CO[i] + e2x * SI[i], cy = e1y * CO[i] + e2y * SI[i], cz = e1z * CO[i] + e2z * SI[i];
    cam.p(P0[0] + cx * r0, P0[1] + cy * r0, P0[2] + cz * r0); capA[2 * i] = cam.X; capA[2 * i + 1] = cam.Y;
    cam.p(P1[0] + cx * r1, P1[1] + cy * r1, P1[2] + cz * r1); capB[2 * i] = cam.X; capB[2 * i + 1] = cam.Y;
  }
  both.set(capA, 0); both.set(capB, CI * 2);
  const h = hull(both, CI * 2);
  cam.p((P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2, (P0[2] + P1[2]) / 2);
  const f1 = cam.faces(P1[0], P1[1], P1[2], ax, ay, az), f0 = cam.faces(P0[0], P0[1], P0[2], -ax, -ay, -az);
  return { d: cam.D, h, cap: f1 ? Float64Array.from(capB) : f0 ? Float64Array.from(capA) : null };
}
function boxPrim(cam, x0, y0, z0, x1, y1, z1) {
  const V8 = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const P = new Float64Array(16);
  V8.forEach((v, i) => { cam.p(v[0], v[1], v[2]); P[2 * i] = cam.X; P[2 * i + 1] = cam.Y; });
  const F6 = [[0, 1, 2, 3, 0, 0, -1], [4, 5, 6, 7, 0, 0, 1], [0, 1, 5, 4, 0, -1, 0], [2, 3, 7, 6, 0, 1, 0], [1, 2, 6, 5, 1, 0, 0], [3, 0, 4, 7, -1, 0, 0]];
  const edges = [];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  for (const f of F6) {
    const px = f[4] ? (f[4] > 0 ? x1 : x0) : cx, py = f[5] ? (f[5] > 0 ? y1 : y0) : cy, pz = f[6] ? (f[6] > 0 ? z1 : z0) : cz;
    if (cam.faces(px, py, pz, f[4], f[5], f[6])) edges.push(f.slice(0, 4));
  }
  cam.p(cx, cy, cz);
  return { d: cam.D, h: hull(P, 8), P, faces: edges };
}

// ---- state set by layout()
const cam = Camera();
let LW = 1, FOG0 = 0, FOG1 = 1, DIST = 3300;
const AZ = -0.62, EL = 0.53;

export function layout(L) {
  LW = L.dpr;
  const f = L.focus;
  // fit the working cell (current shell, carriage, arm reach, gantry) into the focus rect, camera at mid-loop
  cam.set(0, -180, 420, AZ, EL, DIST);
  const pts = [[-170, -170, 0], [170, 170, 0], [0, 170, HP + 40], [0, -170, HP], [-200, YR - 150, 0], [200, YR + 150, 0], [0, YR, 1250], [RX, BY, RZ]];
  // keep the shell's foot clear of the entries' scrim (it is the brightest, busiest spot)
  const r = L.land ? { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 - 34 * L.dpr } : f;
  fitCamera(cam, pts, r, 0.98, 0.5, L.land ? 0.3 : 0.5);
  FOG0 = DIST - 900; FOG1 = DIST + 3600;
}

const fog = (d) => clamp(1 - (d - FOG0) / (FOG1 - FOG0), 0.08, 1) ** 1.15;

// ---- drawing helpers
function strokeHull(g, h, fill, ink, w) {
  g.beginPath(); g.moveTo(h[0], h[1]);
  for (let i = 2; i < h.length; i += 2) g.lineTo(h[i], h[i + 1]);
  g.closePath();
  if (fill) { g.fillStyle = '#000'; g.fill(); }
  if (ink) { g.strokeStyle = ink; g.lineWidth = w; g.stroke(); }
}
function strokeLoop(g, a, ink, w) {
  g.beginPath(); g.moveTo(a[0], a[1]);
  for (let i = 2; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]);
  g.closePath(); g.strokeStyle = ink; g.lineWidth = w; g.stroke();
}

// buckets of line segments by alpha, drawn in one stroke each
function Buckets(n) {
  const b = Array.from({ length: n }, () => []);
  return {
    b, add(k, x0, y0, x1, y1) { const a = b[k]; a.push(x0, y0, x1, y1); },
    clear() { for (const a of b) a.length = 0; },
    draw(g, col, alphaOf, w) {
      g.lineWidth = w;
      for (let k = 0; k < b.length; k++) {
        const a = b[k]; if (!a.length) continue;
        g.strokeStyle = rgba(col, alphaOf(k)); g.beginPath();
        let lx = NaN, ly = NaN;
        for (let i = 0; i < a.length; i += 4) {
          if (a[i] !== lx || a[i + 1] !== ly) g.moveTo(a[i], a[i + 1]);
          g.lineTo(a[i + 2], a[i + 3]); lx = a[i + 2]; ly = a[i + 3];
        }
        g.stroke();
      }
    },
  };
}
const GRID = Buckets(8), RAIL = Buckets(8), BACK = Buckets(8), FRONT = Buckets(8), DOTS = Buckets(8);
const PX = new Float32Array(NS), PY = new Float32Array(NS), PF = new Uint8Array(NS), PD = new Float32Array(NS);

// ---- arm pose as a pure function of time (also used to build the facing table below)
// nozzle target: on the spiral while printing; lift, travel one bay and drop to the next start while moving
function armAt(t, xc) {
  const sNow = sAt(t), o = [0, 0, 0, 0, 0];
  let px, py, pz, ux = 0, uy = 0, uz = -1;
  if (t < TP) {
    shellPt(sNow, 0, o); px = o[0]; py = o[1]; pz = o[2] + 4;
    // tilt the nozzle with the local slope of the non-planar layer (lean along the travel direction)
    const s2 = Math.min(N, sNow + 0.02); const o2 = shellPt(s2, 0, [0, 0, 0, 0, 0]);
    const tdx = o2[0] - o[0], tdy = o2[1] - o[1], tdz = o2[2] - o[2]; const tl = Math.hypot(tdx, tdy) || 1;
    const lean = clamp(tdz / tl, -0.6, 0.6) * 0.9;
    ux = (tdx / tl) * lean * 0.5 + o[3] * 0.08; uy = (tdy / tl) * lean * 0.5 + o[4] * 0.08; uz = -1;
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  } else {
    const oe = shellPt(N, 0, [0, 0, 0, 0, 0]), os = shellPt(0, -S, [0, 0, 0, 0, 0]);
    const up = E.out3(seg(t, TP, TP + 0.7)) * (1 - E.io2(seg(t, DURATION - 0.75, DURATION)));
    const m = E.io3(seg(t, MV0 - 0.1, DURATION - 0.6));
    px = lerp(oe[0], os[0], m); py = lerp(oe[1], os[1], m);
    pz = lerp(oe[2] + 4, os[2] + 4, m) + up * 170 + Math.sin(Math.PI * m) * 60;
  }
  return { A: ik(xc, YR, 110, px, py, pz, ux, uy, uz), ux, uy, uz };
}
// how much the exit patch of a link (from joint J towards Q, housing radius rh) faces the eye
function facing(J, Q, rh, e) {
  let dx = Q[0] - J[0], dy = Q[1] - J[1], dz = Q[2] - J[2]; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
  const ex = e[0] - (J[0] + dx * rh), ey = e[1] - (J[1] + dy * rh), ez = e[2] - (J[2] + dz * rh);
  return (dx * ex + dy * ey + dz * ez) / Math.hypot(ex, ey, ez);
}
// The forearm's facing at the elbow and at the wrist wobbles across zero once per ring early in the print (tools/facing.py,
// sheets/_facing.png). Its in-front weight is therefore taken from that facing averaged over one ring period (two box passes,
// circular over the loop): one smooth hand-over per regime instead of a flicker. The eye only depends on t, not on the layout.
const FT_N = 1000, FT_DT = DURATION / FT_N;
const F_EL = new Float32Array(FT_N), F_WR = new Float32Array(FT_N);
{
  for (let i = 0; i < FT_N; i++) {
    const t = i * FT_DT, xc = -S * E.io3(seg(t, MV0, MV1));
    const az = AZ + 0.045 * Math.sin(TAU * t / DURATION), el = EL + 0.015 * Math.sin(TAU * t / DURATION + 1.2);
    const e = [xc + DIST * Math.cos(el) * Math.sin(az), -180 + DIST * Math.cos(el) * Math.cos(az), 420 + DIST * Math.sin(el)];
    const { A } = armAt(t, xc);
    F_EL[i] = facing(A.E, A.W, 62, e); F_WR[i] = facing(A.W, A.E, 40, e);
  }
  const box = (a, win) => { const h = Math.round(win / FT_DT / 2), out = new Float32Array(FT_N);
    for (let i = 0; i < FT_N; i++) { let sum = 0; for (let k = -h; k <= h; k++) sum += a[(i + k + FT_N) % FT_N]; out[i] = sum / (2 * h + 1); } return out; };
  const ring = TP / N;
  F_EL.set(box(box(F_EL, ring), ring)); F_WR.set(box(box(F_WR, ring), ring));
}
const ftab = (a, t) => { const x = t / FT_DT, i = Math.floor(x) % FT_N, f = x - Math.floor(x); return lerp(a[i], a[(i + 1) % FT_N], f); };
const wIn = (f) => smooth((f + 0.04) / 0.08);   // the smoothed facing is monotonic through each hand-over, so a narrow band is safe

// ---- the frame
export function render(g, t, L) {
  t = ((t % DURATION) + DURATION) % DURATION;
  const w = LW;
  // carriage and camera: the carriage waits at bay 0 while printing, then moves one bay (to -S); the camera pans at constant speed
  const mv = E.io3(seg(t, MV0, MV1));
  const xc = -S * mv;
  const tx = xc;                                   // the camera rides with the carriage (rests while printing)
  const az = AZ + 0.045 * Math.sin(TAU * t / DURATION), el = EL + 0.015 * Math.sin(TAU * t / DURATION + 1.2);
  cam.set(tx, -180, 420, az, el, DIST);   // F, cx, cy stay from the fit (made with the carriage at bay 0)
  g.lineCap = 'round'; g.lineJoin = 'round';

  // floor grid (200 mm), faded by depth and towards its edges; snapped to the grid so the pan is seamless
  GRID.clear(); RAIL.clear();
  const gx0 = Math.floor((tx - 3800) / 200) * 200, gx1 = gx0 + 7800, gy0 = -1800, gy1 = 1400;
  const edge = (x, y) => clamp(1 - Math.abs(x - tx + 400) / 3700) ** 0.8 * clamp((y - gy0) / 900) * clamp((gy1 - y) / 900);
  const gk = (x, y, d) => Math.min(7, Math.floor(fog(d) * edge(x, y) * 8));
  for (let y = gy0; y <= gy1; y += 200) for (let x = gx0; x < gx1; x += 200) {
    cam.p(x, y, 0); const ax = cam.X, ay = cam.Y; cam.p(x + 200, y, 0);
    const k = gk(x + 100, y, cam.D); if (k > 0) GRID.add(k, ax, ay, cam.X, cam.Y);
  }
  for (let x = gx0; x <= gx1; x += 200) for (let y = gy0; y < gy1; y += 200) {
    cam.p(x, y, 0); const ax = cam.X, ay = cam.Y; cam.p(x, y + 200, 0);
    const k = gk(x, y + 100, cam.D); if (k > 0) GRID.add(k, ax, ay, cam.X, cam.Y);
  }
  GRID.draw(g, '#FFFFFF', (k) => 0.018 * k, 0.6 * w);
  // rail: two lines and sleepers
  for (let x = gx0; x < gx1; x += 200) {
    for (const yy of [YR - 95, YR + 95]) { cam.p(x, yy, 0); const ax = cam.X, ay = cam.Y; cam.p(x + 200, yy, 0); const k = gk(x + 100, yy, cam.D); if (k > 0) RAIL.add(k, ax, ay, cam.X, cam.Y); }
    cam.p(x, YR - 130, 0); const ax = cam.X, ay = cam.Y; cam.p(x, YR + 130, 0); const k = gk(x, YR, cam.D); if (k > 0) RAIL.add(k, ax, ay, cam.X, cam.Y);
  }
  RAIL.draw(g, '#FFFFFF', (k) => 0.05 * k, 0.8 * w);

  // shells: the current one (bay 0) and finished ones at +S, +2S ... (they recede into the distance)
  const sNow = sAt(t);
  const shells = [];
  for (let k = BAYS; k >= 0; k--) shells.push({ k, cx: k * S, age: k + t / DURATION });
  // draw finished shells far to near (they never overlap the arm)
  for (const sh of shells) if (sh.k > 0) drawShell(g, sh, N, w, null);

  // carriage (box), mast and gantry (thin cylinders), the arm (sorted), the stereo pair
  const prims = [];
  const { A, ux, uy, uz } = armAt(t, xc);
  // carriage
  prims.push({ ...boxPrim(cam, xc - 190, YR - 150, 0, xc + 190, YR + 150, 110), kind: 'box' });
  // arm links and joints
  const n = A.n;
  const jA = (P, r, hw) => [[P[0] - n[0] * hw, P[1] - n[1] * hw, P[2]], [P[0] + n[0] * hw, P[1] + n[1] * hw, P[2]], r];
  // Arm order, decided per joint from the 3D geometry (Ye 2026-11-22, v3 -> v4). Each link meets its joint housing at the
  // housing's curved surface (the link axis runs through the joint centre, perpendicular to the housing axis). Where that exit
  // patch faces the camera, the link stands in front of the housing; where it faces away, the housing covers the link end.
  // Every link is first drawn whole (the behind version, under the housing); then, after the housing body, the stretch of the
  // link from the housing surface to its midpoint is drawn again with alpha = smoothstep of that facing (the in-front version,
  // starting on the true cylinder-cylinder seam); the housing's visible end cap goes last, since the links lie between its two
  // end planes. Measured over the loop (tools/facing.py): shoulder -> upper arm always faces the camera (+0.48..+0.93);
  // shoulder -> turret, elbow -> upper arm and wrist -> tool always face away; elbow -> forearm (-0.23..+0.70) and
  // wrist -> forearm (-0.62..+0.36) cross over, so the cross-fade (+-0.1) turns those changes into a smooth fade, not a jump.
  const P_base = { ...cylinder(cam, [xc, YR, 110], [xc, YR, 260], 118, 108), kind: 'cyl' };
  const P_tur = { ...cylinder(cam, [xc, YR, 260], [A.S[0] - A.d[0] * 40, A.S[1] - A.d[1] * 40, A.S[2]], 96, 74), kind: 'cyl' };
  const P_up = { ...cylinder(cam, A.S, A.E, 62, 50), kind: 'cyl' };
  const P_sh = (() => { const [a, b, r] = jA(A.S, 86, 78); return { ...cylinder(cam, a, b, r, r), kind: 'cyl' }; })();   // shoulder (A2)
  const P_fore = { ...cylinder(cam, A.E, A.W, 46, 36), kind: 'cyl' };
  const P_el = (() => { const [a, b, r] = jA(A.E, 62, 60); return { ...cylinder(cam, a, b, r, r), kind: 'cyl' }; })();   // elbow (A3)
  prims.push(P_base, P_tur, P_up, P_sh, P_fore, P_el);
  const MUF = [(A.E[0] + A.W[0]) / 2, (A.E[1] + A.W[1]) / 2, (A.E[2] + A.W[2]) / 2], MUS = [(A.S[0] + A.E[0]) / 2, (A.S[1] + A.E[1]) / 2, (A.S[2] + A.E[2]) / 2];
  const OV_sh = linkEnd(A.S, A.E, 86, 62, MUS, 56, n), OV_el = linkEnd(A.E, A.W, 62, 46, MUF, 41, n), OV_wr = linkEnd(A.W, A.E, 40, 36, MUF, 41, n);
  OV_el.a = wIn(ftab(F_EL, t)); OV_wr.a = wIn(ftab(F_WR, t));   // smoothed over a ring period (see the facing table)
  const drawArm = () => {
    drawPrim(g, prims[0], w); drawPrim(g, P_base, w); drawPrim(g, P_tur, w);
    drawPrim(g, P_up, w);
    drawBody(g, P_sh, w); drawOverlay(g, OV_sh, w); drawCap(g, P_sh, w);
    drawPrim(g, P_fore, w);
    drawBody(g, P_el, w); drawOverlay(g, OV_el, w); drawCap(g, P_el, w);
  };
  const T1 = [A.F[0] + ux * 120, A.F[1] + uy * 120, A.F[2] + uz * 120];
  // wrist assembly, drawn as one unit: one coaxial cylinder from the wrist centre to the nozzle collar (wrist link + extruder
  // body, no seam at the flange), the nozzle cone, then the wrist housing centred on W, with the forearm's near end over it
  // when that end faces the camera (see above)
  const tool1 = { ...cylinder(cam, A.W, T1, 32, 28), kind: 'cyl' };
  const tool2 = { ...cylinder(cam, T1, A.P, 12, 3), kind: 'cyl' };
  const wristH = (() => { const [a, b, r] = jA(A.W, 40, 40); return { ...cylinder(cam, a, b, r, r), kind: 'cyl' }; })();   // wrist (A5)
  const drawTool = () => { drawPrim(g, tool1, w); drawPrim(g, tool2, w); drawBody(g, wristH, w); drawOverlay(g, OV_wr, w); drawCap(g, wristH, w); };
  if (JDBG) {
    cam.p(A.E[0], A.E[1], A.E[2]); JDBG.E = [cam.X / L.dpr, cam.Y / L.dpr]; cam.p(A.W[0], A.W[1], A.W[2]); JDBG.W = [cam.X / L.dpr, cam.Y / L.dpr];
    cam.p(A.S[0], A.S[1], A.S[2]); JDBG.S = [cam.X / L.dpr, cam.Y / L.dpr];
    // facing of each link's exit point on its joint housing: > 0 = the exit faces the camera (link in front of the housing)
    const fac = (J, Q, rh) => { let dx = Q[0] - J[0], dy = Q[1] - J[1], dz = Q[2] - J[2]; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const X = [J[0] + dx * rh, J[1] + dy * rh, J[2] + dz * rh]; let ex = cam.ex - X[0], ey = cam.ey - X[1], ez = cam.ez - X[2]; const el3 = Math.hypot(ex, ey, ez);
      return +((dx * ex + dy * ey + dz * ez) / el3).toFixed(3); };
    const TB = [xc, YR, 260];
    JDBG.a = { sh: +OV_sh.a.toFixed(3), el: +OV_el.a.toFixed(3), wr: +OV_wr.a.toFixed(3) };
    JDBG.f = { sh_up: fac(A.S, A.E, 86), sh_turret: fac(A.S, TB, 86), el_up: fac(A.E, A.S, 62), el_fore: fac(A.E, A.W, 62), wr_fore: fac(A.W, A.E, 40), wr_tool: fac(A.W, A.P, 40) };
  }

  // current shell: back half, arm (far to near), front half, tool, then light
  const cur = shells[shells.length - 1];
  const sV = t < TP ? sNow : N + (t - TP) * 2.4;
  drawShell(g, cur, sNow, w, 'back', sV);
  // the truss is in front of the arm, but drawn at full strength across the arm it reads as a collision (Ye 2026-11-22):
  // draw it behind, let the arm's black fills cover it, then show it again over the arm at low alpha (a ghost that follows the arm)
  drawTruss(g, xc, w, gx0, gx1, gk);
  drawArm();
  g.save(); g.beginPath();
  for (const p of prims.concat([tool1, tool2, wristH])) { const h = p.h; g.moveTo(h[0], h[1]); for (let i = 2; i < h.length; i += 2) g.lineTo(h[i], h[i + 1]); g.closePath(); }
  g.clip(); TRU.draw(g, COL.ink, (k) => 0.075 * k * 0.26, 0.7 * w); g.restore();
  // controller chip on the base, facing the viewer
  { const ex = cam.ex - xc, ey = cam.ey - YR, el2 = Math.hypot(ex, ey) || 1; cam.p(xc + ex / el2 * 116, YR + ey / el2 * 116, 186); }
  const chip = [cam.X, cam.Y];
  drawChip(g, chip[0], chip[1], t, w);
  cam.p(A.P[0], A.P[1], A.P[2]);
  const nozzleFront = cam.faces(A.P[0], A.P[1], A.P[2], Math.cos(TH0 + TAU * sNow), Math.sin(TH0 + TAU * sNow), 0) || t >= TP;
  if (!nozzleFront) drawTool();
  drawShell(g, cur, sNow, w, 'front', sV);
  if (nozzleFront) drawTool();

  // stereo pair: clamp on the truss, two small bodies on a bar, frusta to a sweeping look-at window on the work
  drawPrim(g, { ...boxPrim(cam, xc + RX - 40, BY - 45, BZ - BD - 34, xc + RX + 40, BY + 45, BZ - BD), kind: 'box' }, w);
  const rig = [xc + RX, BY, RZ];
  const look = [xc + 110 * Math.sin(TAU * t / (DURATION / 2)), 0, HP * 0.5];
  drawStereo(g, rig, look, w, t);

  // nozzle light (gold, only while printing)
  if (t < TP + 0.2) {
    cam.p(A.P[0], A.P[1], A.P[2]);
    const r = 26 * w * (1 - seg(t, TP - 0.1, TP + 0.2));
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.9;
    g.drawImage(glow(COL.gold), cam.X - r, cam.Y - r, 2 * r, 2 * r);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  // scan points and deviation ticks, all shells
  for (const sh of shells) drawScan(g, sh, t, w);
  // after the print: upload, compare, message (drawn last, over the drawing, inside the focus rect)
  cam.p(rig[0], rig[1], rig[2]);
  if (t >= B_UP0 - 0.05 && t < B_RX1) drawBeat(g, t, w, L, [cam.X, cam.Y], chip);
}

function drawPrim(g, p, w) {
  const ink = rgba(COL.ink, p.thin ? 0.5 : 0.82);
  strokeHull(g, p.h, true, ink, (p.thin ? 0.8 : 1.15) * w);
  if (p.kind === 'cyl' && p.cap) strokeLoop(g, p.cap, rgba(COL.ink, p.thin ? 0.3 : 0.5), 0.7 * w);
  if (p.kind === 'box') {
    g.strokeStyle = rgba(COL.ink, 0.5); g.lineWidth = 0.7 * w; g.beginPath();
    for (const f of p.faces) { g.moveTo(p.P[2 * f[0]], p.P[2 * f[0] + 1]); for (let i = 1; i <= 4; i++) { const v = f[i % 4]; g.lineTo(p.P[2 * v], p.P[2 * v + 1]); } }
    g.stroke();
  }
}

// joint housing drawn in two parts: body (black fill + outline), then the visible end cap (black fill + outline) on top
function drawBody(g, p, w) { strokeHull(g, p.h, true, rgba(COL.ink, 0.82), 1.15 * w); }
function drawCap(g, p, w) {
  if (!p.cap) return;
  const c = p.cap; g.beginPath(); g.moveTo(c[0], c[1]); for (let i = 2; i < c.length; i += 2) g.lineTo(c[i], c[i + 1]); g.closePath();
  g.fillStyle = '#000'; g.fill(); g.strokeStyle = rgba(COL.ink, 0.5); g.lineWidth = 0.7 * w; g.stroke();
}
// the stretch of a link from where it leaves a joint housing (true seam of two cylinders) to the point M, plus how much its exit
// patch faces the camera. J: joint centre, Q: a point further along the link, rh: housing radius, rl: link radius there,
// rm: link radius at M, nAx: housing axis (unit, perpendicular to the link)
const LB = new Float64Array(CI * 2), LM = new Float64Array(CI * 2), LBM = new Float64Array(CI * 4), LV = new Uint8Array(CI);
function linkEnd(J, Q, rh, rl, M, rm, nAx) {
  let dx = Q[0] - J[0], dy = Q[1] - J[1], dz = Q[2] - J[2]; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
  const nx = nAx[0], ny = nAx[1], nz = nAx[2];
  const mx = dy * nz - dz * ny, my = dz * nx - dx * nz, mz = dx * ny - dy * nx;          // m = d x n
  // facing of the exit patch (centre of the seam)
  const X0 = J[0] + dx * rh, Y0 = J[1] + dy * rh, Z0 = J[2] + dz * rh;
  const ex = cam.ex - X0, ey = cam.ey - Y0, ez = cam.ez - Z0, eL = Math.hypot(ex, ey, ez);
  const f = (dx * ex + dy * ey + dz * ez) / eL;
  for (let i = 0; i < CI; i++) {
    const c = CO[i], s2 = SI[i];
    const sd = Math.sqrt(Math.max(0, rh * rh - (rl * s2) ** 2));                          // seam: distance along the link axis
    const ox = c * nx + s2 * mx, oy = c * ny + s2 * my, oz = c * nz + s2 * mz;
    const bx = J[0] + dx * sd + rl * ox, by = J[1] + dy * sd + rl * oy, bz = J[2] + dz * sd + rl * oz;
    cam.p(bx, by, bz); LB[2 * i] = cam.X; LB[2 * i + 1] = cam.Y;
    LV[i] = cam.faces(bx, by, bz, ox, oy, oz) ? 1 : 0;
    cam.p(M[0] + rm * ox, M[1] + rm * oy, M[2] + rm * oz); LM[2 * i] = cam.X; LM[2 * i + 1] = cam.Y;
  }
  LBM.set(LB, 0); LBM.set(LM, CI * 2);
  // hull with labels: the two hull edges that join a seam point to an M point are the link's silhouette lines
  const idx = hullIdx(LBM, CI * 2), sides = [];
  for (let k = 0; k < idx.length; k++) { const a = idx[k], b = idx[(k + 1) % idx.length]; if ((a < CI) !== (b < CI)) sides.push(LBM[2 * a], LBM[2 * a + 1], LBM[2 * b], LBM[2 * b + 1]); }
  const h = []; for (const k of idx) h.push(LBM[2 * k], LBM[2 * k + 1]);
  const seam = []; for (let i = 0; i < CI; i++) { const j = (i + 1) % CI; if (LV[i] && LV[j]) seam.push(LB[2 * i], LB[2 * i + 1], LB[2 * j], LB[2 * j + 1]); }
  return { a: smooth((f + 0.1) / 0.2), f, h, sides, seam };
}
function drawOverlay(g, o, w) {
  if (o.a <= 0.002) return;
  g.globalAlpha = o.a;
  strokeHull(g, o.h, true, null, 0);
  g.strokeStyle = rgba(COL.ink, 0.82); g.lineWidth = 1.15 * w; g.beginPath();
  for (let i = 0; i < o.sides.length; i += 4) { g.moveTo(o.sides[i], o.sides[i + 1]); g.lineTo(o.sides[i + 2], o.sides[i + 3]); }
  g.stroke();
  g.strokeStyle = rgba(COL.ink, 0.6); g.lineWidth = 0.8 * w; g.beginPath();
  for (let i = 0; i < o.seam.length; i += 4) { g.moveTo(o.seam[i], o.seam[i + 1]); g.lineTo(o.seam[i + 2], o.seam[i + 3]); }
  g.stroke();
  g.globalAlpha = 1;
}
// monotone-chain hull returning point indices (for labelled hulls)
function hullIdx(a, n) {
  const idx = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[2 * i] - a[2 * j] || a[2 * i + 1] - a[2 * j + 1]);
  const cr = (o, p, q) => (a[2 * p] - a[2 * o]) * (a[2 * q + 1] - a[2 * o + 1]) - (a[2 * p + 1] - a[2 * o + 1]) * (a[2 * q] - a[2 * o]);
  const lo = [], up = [];
  for (const i of idx) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], i) <= 0) lo.pop(); lo.push(i); }
  for (let k = idx.length - 1; k >= 0; k--) { const i = idx[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], i) <= 0) up.pop(); up.push(i); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

// one shell: grey settled spiral with a gold head over the last turn; `part` = 'back' | 'front' | null (both)
function drawShell(g, sh, sEnd, w, part, sV = sEnd) {
  const n = Math.min(NS - 1, Math.floor(sEnd * K));
  if (n < 1) return;
  const cx = sh.cx;
  for (let i = 0; i <= n; i++) {
    const j = i * 5;
    const x = SH[j] + cx, y = SH[j + 1], z = SH[j + 2];
    cam.p(x, y, z); PX[i] = cam.X; PY[i] = cam.Y; PD[i] = cam.D;
    PF[i] = cam.faces(x, y, z, SH[j + 3], SH[j + 4], 0) ? 1 : 0;
  }
  // partial last segment up to the exact nozzle position
  const fr = sEnd * K - n;
  let ex = PX[n], ey = PY[n];
  if (fr > 0 && n < NS - 1) {
    const j = (n + 1) * 5; cam.p(SH[j] + cx, SH[j + 1], SH[j + 2]);
    ex = lerp(PX[n], cam.X, fr); ey = lerp(PY[n], cam.Y, fr);
  }
  const fogA = fog(PD[Math.floor(n / 2)]);
  const live = sh.k === 0;
  // silhouette fill (dims the grid behind a finished shell)
  if (part !== 'front' && n > K) {
    const hp = []; for (let i = 0; i <= n; i += 4) hp.push(PX[i], PY[i]);
    const h = hull(Float64Array.from(hp), hp.length / 2);
    g.globalAlpha = 0.9; strokeHull(g, h, true, null, 0); g.globalAlpha = 1;
  }
  BACK.clear(); FRONT.clear();
  const goldFrom = live ? sV - 1.0 : Infinity;       // the last turn is "being made now"
  const settle = live ? sV - 2.6 : Infinity;         // after the print sV runs on, so the head settles to grey
  const gold = [];
  for (let i = 0; i < n; i++) {
    const s = i / K;
    if (s >= goldFrom) { gold.push(i); continue; }
    const f = PF[i] && PF[i + 1];
    // recency: from gold-ish to settled grey over 1.6 turns (bucket 7 = settled)
    const k = s > settle ? Math.max(0, Math.min(6, Math.floor((s - settle) / 1.6 * 7))) : 7;
    (f ? FRONT : BACK).add(k, PX[i], PY[i], PX[i + 1], PY[i + 1]);
  }
  const mix = (k) => (k >= 7 ? 0 : 1 - k / 7);   // 1 = gold, 0 = grey
  const colOf = (k, front) => { const m = 1 - mix(k); return front ? [lerp(242, 200, m), lerp(193, 200, m), lerp(78, 200, m), (0.6 + 0.25 * (1 - m)) * fogA] : [lerp(242, 200, m), lerp(193, 200, m), lerp(78, 200, m), (0.13 + 0.2 * (1 - m)) * fogA]; };
  const drawB = (B, front) => {
    for (let k = 0; k < 8; k++) {
      const a = B.b[k]; if (!a.length) continue;
      const c = colOf(k, front);
      g.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`; g.lineWidth = (front ? 0.95 : 0.75) * w;
      g.beginPath(); let lx = NaN, ly = NaN;
      for (let i = 0; i < a.length; i += 4) { if (a[i] !== lx || a[i + 1] !== ly) g.moveTo(a[i], a[i + 1]); g.lineTo(a[i + 2], a[i + 3]); lx = a[i + 2]; ly = a[i + 3]; }
      g.stroke();
    }
  };
  if (part !== 'front') drawB(BACK, false);
  if (part !== 'back') {
    drawB(FRONT, true);
    // centre line (dash-dot, drafting convention) on finished shells
    if (!live || sEnd >= N) {
      cam.p(cx, 0, -40); const ax = cam.X, ay = cam.Y; cam.p(cx, 0, HP + 70);
      g.setLineDash([14 * w, 4 * w, 2 * w, 4 * w]); g.strokeStyle = rgba(COL.ink, 0.2 * fogA); g.lineWidth = 0.6 * w;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(cam.X, cam.Y); g.stroke(); g.setLineDash([]);
    }
  }
  // gold head: the last turn, brighter towards the nozzle
  if (gold.length && part !== 'back') {
    g.lineWidth = 1.7 * w;
    const n0 = gold[0];
    const steps = 5;
    for (let q = 0; q < steps; q++) {
      const a0 = n0 + Math.floor((n - n0) * q / steps), a1 = n0 + Math.floor((n - n0) * (q + 1) / steps);
      g.strokeStyle = rgba(COL.gold, 0.35 + 0.65 * (q + 1) / steps);
      g.beginPath(); g.moveTo(PX[a0], PY[a0]);
      for (let i = a0 + 1; i <= a1; i++) g.lineTo(PX[i], PY[i]);
      if (q === steps - 1) g.lineTo(ex, ey);
      g.stroke();
    }
  }
}

// blue points settle onto the surface along the camera ray; white ticks mark departures from the plan
function drawScan(g, sh, t, w) {
  const tl = sh.k === 0 ? t : 1e9;            // the shell's own clock
  const fade = clamp(1.25 - 0.22 * sh.age, 0.1, 1);
  const RIGX = sh.cx + RX, RIGY = BY, RIGZ = RZ;
  DOTS.clear();
  for (const p of PTS) {
    const u = (tl - p.ta) / 0.9;
    if (u < 0) continue;
    const e = E.out3(u), a = clamp(u * 3) * fade;
    const x = p.x + sh.cx;
    const dx = RIGX - x, dy = RIGY - p.y, dz = RIGZ - p.z, dl = Math.hypot(dx, dy, dz);
    const off = p.dn * (1 - e) / dl;
    cam.p(x + dx * off, p.y + dy * off, p.z + dz * off);
    const k = Math.min(7, Math.floor(a * fog(cam.D) * 8));
    if (k > 0) { const s = 1.6 * p.sz * w; DOTS.b[k].push(cam.X - s / 2, cam.Y - s / 2, s, 0); }
  }
  for (let k = 1; k < 8; k++) {
    const b = DOTS.b[k]; if (!b.length) continue;
    g.fillStyle = rgba(COL.blue, 0.9 * (k + 0.5) / 8); g.beginPath();
    for (let i = 0; i < b.length; i += 4) g.rect(b[i], b[i + 1], b[i + 2], b[i + 2]);
    g.fill();
  }
  // ticks
  for (const k of TICKS) {
    const u = tl - k.ta;
    if (u < 0) continue;
    const grow = E.outBack(seg(u, 0, 0.35)), shrink = E.io2(seg(u, 2.4, 3.0));
    const len = 34 * grow * (1 - shrink * 0.85);
    const x = k.x + sh.cx;
    cam.p(x, k.y, k.z); const ax = cam.X, ay = cam.Y; const fa = fog(cam.D) * fade;
    cam.p(x + k.nx * len, k.y + k.ny * len, k.z); const bx = cam.X, by = cam.Y;
    g.strokeStyle = rgba(COL.white, 0.95 * fa); g.lineWidth = 1.1 * w;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by);
    // small bar across the end of the tick
    const dx = bx - ax, dy = by - ay, dl = Math.hypot(dx, dy) || 1, q = 3.5 * w * grow * (1 - shrink);
    g.moveTo(bx - dy / dl * q, by + dx / dl * q); g.lineTo(bx + dy / dl * q, by - dx / dl * q);
    g.stroke();
    g.beginPath(); g.arc(ax, ay, 2.2 * w * (1 - 0.55 * shrink), 0, TAU); g.stroke();
  }
}

function drawStereo(g, rig, look, w, t) {
  let fx = look[0] - rig[0], fy = look[1] - rig[1], fz = look[2] - rig[2]; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let bx = fy, by = -fx; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;           // baseline, horizontal
  const ux = by * fz, uy = -bx * fz, uz = bx * fy - by * fx;                                // up' = b x f
  // bodies (two small boxes on a bar) and the hanger
  drawPrim(g, { ...cylinder(cam, [rig[0], rig[1], BZ - BD - 30], [rig[0], rig[1], rig[2] + 10], 9, 9), kind: 'cyl', thin: true }, w);
  const B = 105, hw = 200, hh = 150;
  const C = [-1, 1].map((sg) => [rig[0] + bx * B * sg, rig[1] + by * B * sg, rig[2]]);
  // the bar, then two lens barrels looking at the work (cylinders, so their front rims read as ellipses)
  drawPrim(g, { ...cylinder(cam, C[0], C[1], 14, 14), kind: 'cyl' }, w);
  const lens = C.map((c) => ({ ...cylinder(cam, [c[0] - fx * 30, c[1] - fy * 30, c[2] - fz * 30], [c[0] + fx * 34, c[1] + fy * 34, c[2] + fz * 34], 27, 24), kind: 'cyl' }));
  lens.sort((p, q) => q.d - p.d).forEach((p) => drawPrim(g, p, w));
  for (let i = 0; i < 2; i++) C[i] = [C[i][0] + fx * 34, C[i][1] + fy * 34, C[i][2] + fz * 34];
  // window on the work, perpendicular to the view
  const W4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [look[0] + bx * a * hw + ux * b * hh, look[1] + by * a * hw + uy * b * hh, look[2] + uz * b * hh]);
  const pulse = 0.75 + 0.25 * Math.cos(TAU * t / (DURATION / 4));
  g.lineWidth = 0.7 * w;
  for (const c of C) {
    cam.p(c[0], c[1], c[2]); const cx = cam.X, cy = cam.Y;
    g.strokeStyle = rgba(COL.blue, 0.3 * pulse); g.beginPath();
    for (const q of W4) { cam.p(q[0], q[1], q[2]); g.moveTo(cx, cy); g.lineTo(cam.X, cam.Y); }
    g.stroke();
    g.fillStyle = rgba(COL.blue, 0.9); g.beginPath(); g.arc(cx, cy, 2.4 * w, 0, TAU); g.fill();
  }
  g.strokeStyle = rgba(COL.blue, 0.45 * pulse); g.lineWidth = 0.8 * w; g.beginPath();
  W4.forEach((q, i) => { cam.p(q[0], q[1], q[2]); i ? g.lineTo(cam.X, cam.Y) : g.moveTo(cam.X, cam.Y); });
  g.closePath(); g.stroke();
  // corner marks inside the window (a viewfinder, not a box)
  g.strokeStyle = rgba(COL.blue, 0.7 * pulse); g.lineWidth = 1.1 * w; g.beginPath();
  for (let i = 0; i < 4; i++) {
    const q = W4[i], a = W4[(i + 1) % 4], b = W4[(i + 3) % 4];
    const m = 0.16;
    cam.p(q[0] + (a[0] - q[0]) * m, q[1] + (a[1] - q[1]) * m, q[2] + (a[2] - q[2]) * m); g.moveTo(cam.X, cam.Y);
    cam.p(q[0], q[1], q[2]); g.lineTo(cam.X, cam.Y);
    cam.p(q[0] + (b[0] - q[0]) * m, q[1] + (b[1] - q[1]) * m, q[2] + (b[2] - q[2]) * m); g.lineTo(cam.X, cam.Y);
  }
  g.stroke();
}

// overhead truss along the rail, in front of the work: two chords and diagonals every 200 mm (seamless with the bay)
const TRU = Buckets(8);
function drawTruss(g, xc, w, gx0, gx1, gk) {
  TRU.clear();
  const zt = BZ, zb = BZ - BD;
  for (let x = gx0; x < gx1; x += 200) {
    cam.p(x, BY, zt); const ax = cam.X, ay = cam.Y; cam.p(x + 200, BY, zt); const bx = cam.X, by = cam.Y;
    const k = gk(x + 100, 0, cam.D); if (k <= 0) continue;
    cam.p(x, BY, zb); const cx = cam.X, cy = cam.Y; cam.p(x + 200, BY, zb); const dx = cam.X, dy = cam.Y;
    TRU.add(k, ax, ay, bx, by); TRU.add(k, cx, cy, dx, dy);
    TRU.add(k, ax, ay, dx, dy);   // one diagonal direction only: the pattern must repeat every 200 mm for the seam
    TRU.add(Math.max(1, k - 2), ax, ay, cx, cy);
  }
  TRU.draw(g, COL.ink, (k) => 0.075 * k, 0.75 * w);
}

// ---- after-print beat -------------------------------------------------------------------------------------------
// deviation per layer (0..1): small everywhere, larger where the white ticks sit (layers 4, 8, 11); decorative, not data
const DEV = Array.from({ length: N }, (_, i) => 0.14 + 0.1 * Math.abs(Math.sin(i * 2.3 + 0.7)));
for (const [i, v] of [[4, 0.82], [8, 0.66], [11, 0.95]]) DEV[i] = v;
// correction (model output): a smoothed version of the deviation, drawn below the axis
const COR = DEV.map((_, i) => { let a = 0, n = 0; for (let k = -1; k <= 1; k++) { const j = i + k; if (j >= 0 && j < N) { const wk = k ? 0.25 : 0.5; a += DEV[j] * wk; n += wk; } } return a / n; });
// the full reconstruction for the scan pane (all sides, as after the last sweep)
const SCAN3D = [];
{ const rng = RNG(21), o = [0, 0, 0, 0, 0]; for (let i = 0; i < 560; i++) { const s = rng.r(0.1, N); shellPt(s, 0, o); SCAN3D.push([o[0] + o[3] * rng.n() * 4, o[1] + o[4] * rng.n() * 4, o[2]]); } }
// local review only: with ?hero-debug the elbow and wrist screen positions (css px) are exposed for the joint check
const JDBG = typeof location !== 'undefined' && location.search.includes('hero-debug') ? (globalThis.__heroJoints = {}) : null;
const FONT = (px) => `600 ${px}px "Archivo Variable", system-ui, sans-serif`;

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// the robot's controller chip: always drawn (small, dim); flashes gold when the correction arrives, then notes "received"
function drawChip(g, x, y, t, w) {
  const s = 5 * w;
  const rx = seg(t, B_PK1, B_PK1 + 0.7);
  const hot = t >= B_PK1 && t < B_PK1 + 0.7 ? 1 - rx : 0;
  g.lineWidth = 0.8 * w;
  g.strokeStyle = rgba(COL.ink, 0.55 + 0.4 * hot); g.beginPath();
  for (let k = -1; k <= 1; k++) { g.moveTo(x - s, y + k * s * 0.55); g.lineTo(x - s - 2.5 * w, y + k * s * 0.55); g.moveTo(x + s, y + k * s * 0.55); g.lineTo(x + s + 2.5 * w, y + k * s * 0.55); }
  g.stroke();
  g.fillStyle = hot > 0 ? rgba(COL.gold, 0.15 + 0.75 * hot) : '#000'; g.fillRect(x - s, y - s, 2 * s, 2 * s);
  g.strokeRect(x - s, y - s, 2 * s, 2 * s);
  if (hot > 0) { const r = s * (1.4 + 2.6 * rx); g.strokeStyle = rgba(COL.gold, 0.8 * (1 - rx)); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  const na = Math.min(seg(t, B_PK1 + 0.1, B_PK1 + 0.35), 1 - seg(t, B_RX1 - 0.45, B_RX1));
  if (na > 0) {
    const left = x > g.canvas.width - 90 * w;
    const tx = left ? x - s - 6 * w : x + s + 6 * w;
    g.strokeStyle = rgba(COL.ink, 0.9 * na); g.lineWidth = 1.2 * w; g.beginPath();
    const cx = left ? tx - 8 * w : tx;
    g.moveTo(cx, y); g.lineTo(cx + 3 * w, y + 3 * w); g.lineTo(cx + 8 * w, y - 3.5 * w); g.stroke();
    g.font = FONT(9 * w); g.textBaseline = 'middle'; g.textAlign = left ? 'right' : 'left'; g.fillStyle = rgba(COL.ink, 0.85 * na);
    g.fillText('received', left ? cx - 4 * w : cx + 12 * w, y + 0.5 * w);
  }
}

// window rect (device px) inside the focus rect, clear of the chip
function winRect(L, chip) {
  const f = L.focus, d = L.dpr, fw = f.x1 - f.x0, fh = f.y1 - f.y0;
  let ww, wh, x0, y0;
  if (L.land) { ww = clamp(fw * 0.64, 300 * d, 440 * d); wh = ww * 0.6; x0 = f.x1 - ww - 6 * d; y0 = f.y0 + 4 * d; }
  else { ww = fw - 8 * d; wh = Math.min(ww * 0.52, fh * 0.7); x0 = f.x0 + 4 * d; y0 = f.y0 + 2 * d; }
  if (chip[1] > y0 && chip[0] > x0 - 20 * d && chip[0] < x0 + ww + 20 * d) wh = Math.min(wh, chip[1] - 22 * d - y0);
  return { x0, y0, ww, wh };
}

function drawCloud(g, x, y, s, a) {
  const C = [[-8, 1, 5.5], [0, -3, 7.5], [9, 1.5, 5]];
  g.lineWidth = s; g.strokeStyle = rgba(COL.ink, 0.85 * a);
  g.beginPath(); for (const [dx, dy, r] of C) { g.moveTo(x + (dx + r) * s, y + dy * s); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); } g.stroke();
  g.beginPath(); g.moveTo(x - 13.5 * s, y + 6 * s); g.lineTo(x + 14 * s, y + 6 * s); g.stroke();
  g.fillStyle = '#000'; g.beginPath();
  for (const [dx, dy, r] of C) { g.moveTo(x + (dx + r - 0.9) * s, y + dy * s); g.arc(x + dx * s, y + dy * s, (r - 0.9) * s, 0, TAU); }
  g.rect(x - 13 * s, y - 1 * s, 26.5 * s, 6.4 * s); g.fill();
  // upload arrow (blue: the data going up is measured)
  g.strokeStyle = rgba(COL.blue, 0.95 * a); g.lineWidth = s; g.beginPath();
  g.moveTo(x, y + 4 * s); g.lineTo(x, y - 4 * s); g.moveTo(x - 3 * s, y - 1.2 * s); g.lineTo(x, y - 4.2 * s); g.lineTo(x + 3 * s, y - 1.2 * s); g.stroke();
}

function drawBeat(g, t, w, L, rigS, chip) {
  const d = L.dpr;
  // 1. upload callout above the stereo pair: blue dots rise into a cloud
  const cx = rigS[0] - (L.land ? 58 : 46) * d, cy = rigS[1] - (L.land ? 92 : 74) * d;
  const ca = Math.min(seg(t, B_UP0, B_UP0 + 0.25), 1 - seg(t, B_WIN0 + 0.15, B_WIN0 + 0.4));
  if (ca > 0) {
    g.lineWidth = 0.7 * w; g.setLineDash([2 * w, 3 * w]); g.strokeStyle = rgba(COL.blue, 0.35 * ca);
    g.beginPath(); g.moveTo(rigS[0], rigS[1] - 6 * d); g.lineTo(cx, cy + 10 * d); g.stroke(); g.setLineDash([]);
    g.fillStyle = rgba(COL.blue, 0.95 * ca);
    for (let k = 0; k < 3; k++) {
      const q = ((t - B_UP0) / 0.55 + k / 3) % 1;
      const x = lerp(rigS[0], cx, q), y = lerp(rigS[1] - 6 * d, cy + 10 * d, q), r = 1.9 * d * (1 - 0.4 * q);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    drawCloud(g, cx, cy, (L.land ? 2.0 : 1.45) * d * (0.85 + 0.15 * E.outBack(seg(t, B_UP0, B_UP0 + 0.35))), ca);
  }
  // 2. the compare window, popping out of the cloud
  const R = winRect(L, chip);
  const u = R.ww / 380;                           // device px per window unit
  const open = E.out3(seg(t, B_WIN0, B_WIN0 + 0.45)), close = E.in2(seg(t, B_WCL0, B_WCL1));
  const op = open * (1 - close);
  // chart geometry (needed for the packet after the window closes)
  const bx0 = R.x0 + 10 * u, bx1 = R.x0 + R.ww - 10 * u, by0 = R.y0 + 26 * u, by1 = R.y0 + R.wh - 9 * u;
  const ph = (by1 - by0 - 8 * u) * 0.58, pw = (bx1 - bx0 - 8 * u) / 2;
  const cy0 = by0 + ph + 8 * u, cy1 = by1, cmid = (cy0 + cy1) / 2 + 2 * u, ch = (cy1 - cy0) / 2 - 3 * u;
  const cxs = (i) => bx0 + 56 * u + (i + 0.5) / N * (bx1 - bx0 - 60 * u);
  if (op > 0.001) {
    g.save();
    const sc = 0.86 + 0.14 * open - 0.04 * close;
    g.translate(cx, cy); g.scale(sc, sc); g.translate(-cx, -cy);
    g.globalAlpha = op;
    roundRect(g, R.x0, R.y0, R.ww, R.wh, 6 * u); g.fillStyle = '#050505'; g.fill();
    g.strokeStyle = rgba(COL.ink, 0.42); g.lineWidth = 1 * d; g.stroke();
    // title bar
    g.strokeStyle = rgba(COL.ink, 0.16); g.beginPath(); g.moveTo(R.x0, R.y0 + 18 * u); g.lineTo(R.x0 + R.ww, R.y0 + 18 * u); g.stroke();
    g.fillStyle = rgba(COL.ink, 0.32); for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(R.x0 + (11 + 8 * k) * u, R.y0 + 9 * u, 2.2 * u, 0, TAU); g.fill(); }
    g.font = FONT(9 * u); g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = rgba(COL.ink, 0.62);
    g.fillText('model · scan · compare', R.x0 + R.ww / 2, R.y0 + 9.5 * u);
    // panes
    const paneL = [bx0, by0, pw, ph], paneR = [bx0 + pw + 8 * u, by0, pw, ph];
    g.strokeStyle = rgba(COL.ink, 0.16); g.lineWidth = 0.8 * d;
    for (const P of [paneL, paneR]) g.strokeRect(P[0], P[1], P[2], P[3]);
    g.textAlign = 'left'; g.font = FONT(8 * u);
    g.fillStyle = rgba(COL.ink, 0.6); g.fillText('model', paneL[0] + 5 * u, paneL[1] + 7 * u);
    g.fillStyle = rgba(COL.blue, 0.9); g.fillText('scan', paneR[0] + 5 * u, paneR[1] + 7 * u);
    const az = 0.35 + 0.5 * (t - B_WIN0);
    const view = paneView(paneL, az, u), viewR = paneView(paneR, az, u);
    drawSolid(g, view, u);
    // scan: points appear bottom-up
    const sp = seg(t, B_SCAN0, B_SCAN0 + 0.75);
    g.fillStyle = rgba(COL.blue, 0.9); g.beginPath();
    for (const q of SCAN3D) { if (q[2] / HP > sp * 1.05) continue; const v = viewR(q[0], q[1], q[2]); if (!v.f) continue; g.rect(v.X - 0.8 * u, v.Y - 0.8 * u, 1.6 * u, 1.6 * u); }
    g.fill();
    // chart: deviation per layer (white bars) above the axis, correction (gold) below it
    g.fillStyle = rgba(COL.white, 0.9); g.fillText('deviation', bx0, cmid - ch * 0.5);
    g.fillStyle = rgba(COL.gold, 0.9); g.fillText('correction', bx0, cmid + ch * 0.5);
    g.strokeStyle = rgba(COL.ink, 0.3); g.lineWidth = 0.8 * d; g.beginPath(); g.moveTo(cxs(-0.6), cmid); g.lineTo(cxs(N - 0.4), cmid); g.stroke();
    const bw = 0.42 * (cxs(1) - cxs(0));
    for (let i = 0; i < N; i++) {
      const gr = E.out3(seg(t, B_CMP0 + 0.04 * i, B_CMP0 + 0.04 * i + 0.35));
      if (gr <= 0) continue;
      const h = DEV[i] * ch * gr, big = DEV[i] > 0.5;
      g.fillStyle = rgba(COL.white, big ? 0.92 : 0.42); g.fillRect(cxs(i) - bw / 2, cmid - h, bw, h);
    }
    // white rings on both panes where the scan departs from the model, tied to their bars by thin leaders
    const cm = seg(t, B_CMP0, B_CMP0 + 0.4);
    if (cm > 0) {
      for (const k of TICKS) {
        const li = Math.min(N - 1, Math.floor(k.s));
        for (const vv of [view, viewR]) {
          const v = vv(k.x, k.y, k.z); if (!v.f) continue;
          const X = v.X, Y = v.Y;
          g.strokeStyle = rgba(COL.white, 0.95 * cm); g.lineWidth = 1 * d; g.beginPath(); g.arc(X, Y, (2 + 2.5 * cm) * u, 0, TAU); g.stroke();
          if (vv === viewR) { g.strokeStyle = rgba(COL.white, 0.28 * cm); g.lineWidth = 0.6 * d; g.beginPath(); g.moveTo(X, Y + 4 * u); g.lineTo(cxs(li), cmid - DEV[li] * ch - 1 * u); g.stroke(); }
        }
      }
    }
    // correction line drawn left to right
    const cp = seg(t, B_COR0, B_COR0 + 0.6);
    if (cp > 0) {
      g.strokeStyle = rgba(COL.gold, 0.95); g.lineWidth = 1.3 * d; g.beginPath();
      const n = cp * (N - 1);
      for (let i = 0; i <= Math.floor(n); i++) { const x = cxs(i), y = cmid + COR[i] * ch * 0.8; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      const i0 = Math.floor(n), fr = n - i0;
      if (i0 < N - 1) g.lineTo(lerp(cxs(i0), cxs(i0 + 1), fr), cmid + lerp(COR[i0], COR[i0 + 1], fr) * ch * 0.8);
      g.stroke();
    }
    g.restore();
  }
  // 3. the correction leaves the chart as a gold packet and flies to the robot's chip
  if (t >= B_COR0 + 0.6 && t < B_PK1 + 0.05) {
    const p0 = [cxs(N - 1), cmid + COR[N - 1] * ch * 0.8], p1 = chip;
    const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const c = [(p0[0] + p1[0]) / 2 + 0.12 * dist, Math.min(p0[1], p1[1]) - 0.1 * dist];
    const at = (q) => { const a = (1 - q) * (1 - q), b = 2 * q * (1 - q), e = q * q; return [a * p0[0] + b * c[0] + e * p1[0], a * p0[1] + b * c[1] + e * p1[1]]; };
    const q = E.io2(seg(t, B_PK0, B_PK1));
    for (let k = 7; k >= 0; k--) {
      const qq = q - k * 0.025; if (qq < 0) continue;
      const [x, y] = at(qq);
      g.fillStyle = rgba(COL.gold, k ? 0.5 * (1 - k / 8) : 1); g.beginPath(); g.arc(x, y, (k ? 1.6 : 2.6) * d, 0, TAU); g.fill();
    }
    const [x, y] = at(q), rr = 12 * d;
    g.globalCompositeOperation = 'lighter'; g.drawImage(glow(COL.gold), x - rr, y - rr, 2 * rr, 2 * rr); g.globalCompositeOperation = 'source-over';
  }
}

// orthographic view into a pane: turn by az about the shell axis, tilt by a fixed elevation, fit the shell
function paneView(P, az, u) {
  const el = 0.5, ce = Math.cos(el), se = Math.sin(el), ca = Math.cos(az), sa = Math.sin(az);
  const s = Math.min(P[2] / 380, P[3] / (HP * ce + 360 * se)) * 0.86;
  const ox = P[0] + P[2] / 2, oy = P[1] + P[3] / 2 + (HP * ce - 150 * se) * s / 2 + 4 * u;
  const out = { X: 0, Y: 0, f: true };
  const fn = (x, y, z, nx, ny) => {
    const xr = x * ca - y * sa, yr = x * sa + y * ca;
    out.X = ox + xr * s; out.Y = oy - (z * ce + yr * se) * s;   // seen from slightly above: nearer (yr < 0) sits lower
    out.f = nx === undefined ? yr < 40 : (nx * sa + ny * ca) < 0;   // the viewer is on -y (rotated)
    return out;
  };
  fn.ca = ca; fn.sa = sa;
  return fn;
}
// the model as a CAD solid: flat-shaded quads between layer rings, inside faces first, then outside faces.
// The grid is built once; each frame only projects its (N + 1) x (J + 1) points.
const SOL = Array.from({ length: 12 }, () => []);
const SJ = 40, SG = new Float32Array((N + 1) * (SJ + 1) * 5);
for (let i = 0; i <= N; i++) for (let j = 0; j <= SJ; j++) {
  const th = TAU * j / SJ, uu = i / N, r = Rr(uu) * (1 + 0.055 * Math.cos(5 * th + 1.4 * uu)), k = (i * (SJ + 1) + j) * 5;
  SG[k] = r * Math.cos(th); SG[k + 1] = r * Math.sin(th); SG[k + 2] = (HP / N) * i + 34 * uu * uu * Math.sin(2 * th + 0.7);
  SG[k + 3] = Math.cos(th + Math.PI / SJ); SG[k + 4] = Math.sin(th + Math.PI / SJ);   // normal at the quad's middle
}
const SX2 = new Float32Array((N + 1) * (SJ + 1)), SY2 = new Float32Array((N + 1) * (SJ + 1));
function drawSolid(g, view, u) {
  for (const b of SOL) b.length = 0;
  const lx = -0.62, ly = -0.72;   // key light from the front left, in view space
  for (let q = 0; q < SX2.length; q++) { const v = view(SG[5 * q], SG[5 * q + 1], SG[5 * q + 2]); SX2[q] = v.X; SY2[q] = v.Y; }
  for (let i = 0; i < N; i++) for (let j = 0; j < SJ; j++) {
    const a = i * (SJ + 1) + j, nx = SG[5 * a + 3], ny = SG[5 * a + 4];
    const nyr = nx * view.sa + ny * view.ca, nxr = nx * view.ca - ny * view.sa;
    const front = nyr < 0;
    const lam = Math.max(0, nxr * lx + nyr * ly + 0.15);
    const k = front ? 4 + Math.min(7, Math.floor(lam * 6)) : Math.min(3, Math.floor(lam * 3));
    SOL[k].push(a);
  }
  for (let k = 0; k < 12; k++) {
    if (!SOL[k].length) continue;
    const v = k < 4 ? 34 + 10 * k : 78 + 15 * (k - 4);
    g.fillStyle = `rgb(${v},${v},${v})`; g.strokeStyle = g.fillStyle; g.lineWidth = 0.6 * u; g.beginPath();
    for (const a of SOL[k]) { const b = a + 1, c = a + SJ + 2, e = a + SJ + 1; g.moveTo(SX2[a], SY2[a]); g.lineTo(SX2[b], SY2[b]); g.lineTo(SX2[c], SY2[c]); g.lineTo(SX2[e], SY2[e]); g.closePath(); }
    g.fill(); g.stroke();
  }
  // rim edge, like a CAD edge display
  g.strokeStyle = rgba(COL.ink, 0.7); g.lineWidth = 0.8 * u; g.beginPath();
  for (let j = 0; j <= SJ; j++) { const q = N * (SJ + 1) + j; j ? g.lineTo(SX2[q], SY2[q]) : g.moveTo(SX2[q], SY2[q]); }
  g.stroke();
}
