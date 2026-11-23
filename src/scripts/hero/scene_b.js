// Hero candidate B, "Cloud, path, object": one vessel on a turntable goes round the closed loop of in-process printing.
//   measure  a stereo scan of the camera-facing side: blue points in image rows, depth noise settling (0 - 2.6 s)
//   plan     every point slides from its scan row onto its slice ring and turns gold; the unseen side is filled in gold
//   make     a nozzle retraces the rings bottom-up as one spiral; each ring fuses into a shaded grey bead line
//   measure  a blue light sheet runs down the finished vessel and turns it back into scan points (white ticks: departures)
// The vessel turns once per loop, so the loop is seamless. Procedural geometry, no measured data. Units: mm, Z up.
import { TAU, clamp, lerp, seg, E, RNG, Camera, fitCamera, glow, rgba, COL } from './v3d.js';

export const NAME = 'b';
export const DURATION = 16;
export const START = 2.0;            // first frame: the scan cloud, about to resolve into rings
export const STILL_T = 8.6;          // reduced motion: printed lower half, gold plan above, nozzle
export const LABEL = 'Animated drawing: a stereo point cloud of a vessel resolves into sliced toolpath rings, a nozzle retraces them into a solid, and a scan turns it back into points.';

const H = 1000, NR = 30, LH = H / NR;
const Rv = (u) => 215 + 190 * Math.exp(-(((u - 0.36) / 0.27) ** 2)) + 55 * Math.exp(-(((u - 1) / 0.09) ** 2)) - 20 * u;
const LOBES = 6, LA = 0.075, TW = 1.25;
const rAt = (th, z) => { const u = z / H; return Rv(u) * (1 + LA * Math.cos(LOBES * th + TW * u)); };
// timeline
const T_SET = 2.6;                     // scan noise settles by here
const T_SL0 = 2.6, T_SL1 = 5.4;        // points slide onto rings (staggered bottom-up)
const T_P0 = 5.4, T_P1 = 11.8;         // print: one spiral over all rings
const T_S0 = 13.4, T_S1 = 15.6;        // rescan: light sheet top -> bottom
const TURN = TAU / 3;                  // the vessel turns 120 deg per loop (a multiple of its 60 deg lobe symmetry)
const SPIN = TURN / DURATION;
const TH_START = 0.6;                  // spiral start angle (object space)

const sweepZ = (t) => H * (1 - E.io2(seg(t, T_S0, T_S1)));
const tCap = (z) => T_S0 + (T_S1 - T_S0) * invIo2(1 - z / H);   // time the sheet passes height z
function invIo2(y) { y = clamp(y); return y < 0.5 ? Math.sqrt(y / 2) : 1 - Math.sqrt((1 - y) / 2); }
// print speed ramp: slow first ring, fast middle (time-lapse), slow last ring
const ramp = (u) => { u = clamp(u); return u - 0.84 * Math.sin(TAU * u) / TAU; };
function invRamp(y) { let u = clamp(y); for (let i = 0; i < 6; i++) u -= (ramp(u) - y) / (1 - 0.84 * Math.cos(TAU * u)); return clamp(u); }
const sPrint = (t) => NR * ramp(seg(t, T_P0, T_P1));                // spiral progress in rings
const tPrint = (j, th) => T_P0 + (T_P1 - T_P0) * invRamp((j + ((((th - TH_START) % TAU) + TAU) % TAU) / TAU) / NR);

// ---- particles
const CAM_AZ = 0.55;          // the stereo camera's azimuth relative to the viewer (front-right)
const PH_CAP = SPIN * (0.5 * (T_S0 + T_S1));
const P = [];                 // measured: { th, zm, j, dn, sz, kind: 0 }, generated: kind 1
{
  const rng = RNG(11);
  const ROWS = 46, COLS = 52;
  // object-space azimuth that faces the stereo camera at capture (object rotated by PH_CAP)
  const face = (Math.PI / 2 - CAM_AZ) - PH_CAP;    // the viewer's eye is on +y; the stereo camera sits CAM_AZ to its right
  for (let r = 0; r < ROWS; r++) {
    const z = (r + 0.5) / ROWS * H;
    const Rm = Rv(z / H) * (1 + LA);
    for (let c = 0; c < COLS; c++) {
      const xl = ((c + 0.5) / COLS * 2 - 1) * Rm * 0.985;
      if (Math.abs(xl) > Rm * 0.97) continue;
      // stored as captured in the previous loop (object turned TURN less), the state that lives across the seam
      const th = face + TURN + Math.asin(clamp(xl / Rm, -1, 1)) + rng.r(-0.01, 0.01);
      if (rng.f() < 0.07) continue;                       // dropouts, like a real depth map
      const j = clamp(Math.round(z / LH - 0.5), 0, NR - 1);
      P.push({ th, zm: z, j, dn: rng.n() * 26, sz: rng.r(0.85, 1.2), kind: 0, tg: 0, jit: rng.r(0, 0.25) });
    }
  }
  // generated points: the unseen side of every ring
  for (let j = 0; j < NR; j++) {
    const n = 56;
    for (let i = 0; i < n; i++) {
      const th = face + TURN + Math.PI * 0.5 + (i + 0.5) / n * Math.PI + rng.r(-0.02, 0.02);
      P.push({ th, zm: (j + 0.5) * LH, j, dn: 0, sz: rng.r(0.8, 1.05), kind: 1, tg: T_SL0 + 0.5 + 1.6 * j / NR + rng.r(0, 0.3), jit: rng.r(0, 0.25) });
    }
  }
  for (const p of P) { p.tc = tCap(p.zm); p.tp = tPrint(p.j, p.th); p.ts = T_SL0 + 1.5 * p.j / NR + p.jit; }
}
// deviation ticks: (object th, z), relative to the face
const TK = [[-0.45, 0.32], [0.3, 0.61], [-0.1, 0.83]].map(([a, u]) => ({ a, z: u * H }));

// ---- view
const cam = Camera();
let LW = 1, RING = 128;
const EL = 0.30, DIST = 4300, AZ = 0;
export function layout(L) {
  LW = L.dpr;
  cam.set(0, 0, H * 0.46, AZ, EL, DIST);
  const pts = [];
  for (let k = 0; k < 16; k++) { const a = TAU * k / 16; pts.push([Math.cos(a) * 470, Math.sin(a) * 470, 0], [Math.cos(a) * 440, Math.sin(a) * 440, 360], [Math.cos(a) * 280, Math.sin(a) * 280, H + 30]); }
  fitCamera(cam, pts, L.focus, L.land ? 0.9 : 0.94, 0.5, 0.5);
  RING = L.W < 1200 ? 96 : 128;
}

// object space -> world: rotate by phi about Z
let cph = 1, sph = 0;
function proj(th, z, r) {
  const x = r * Math.cos(th), y = r * Math.sin(th);
  return cam.p(x * cph - y * sph, x * sph + y * cph, z);
}

// batches
const NB = 8;
const BLUE = Array.from({ length: NB }, () => []), GOLD = Array.from({ length: NB }, () => []);
const MIX = Array.from({ length: 4 }, () => Array.from({ length: NB }, () => []));
const LINES = Array.from({ length: NB }, () => []), BACKS = [];

export function render(g, t, L) {
  t = ((t % DURATION) + DURATION) % DURATION;
  const w = LW;
  const ph = SPIN * t; cph = Math.cos(ph); sph = Math.sin(ph);
  const nearD = DIST - 520, farD = DIST + 520;
  const depthA = (d) => clamp(1 - (d - nearD) / (farD - nearD) * 0.75, 0.2, 1);   // back of the vessel dimmer
  g.lineCap = 'round'; g.lineJoin = 'round';

  // ---- floor: polar grid (static) and the turntable (turns with the vessel)
  drawFloor(g, w, ph);

  // ---- solid bead lines (printed rings), shaded by a fixed light; hidden where facing away
  const sNow = t >= T_P0 ? sPrint(t) : (t < T_S1 && t >= T_P0 ? NR : 0);
  const solidVisible = t >= T_P0;
  for (const b of LINES) b.length = 0;
  BACKS.length = 0;
  let headX = 0, headY = 0, headOk = false;
  const gold = [];
  const trail = clamp(0.3 + 0.1 * (sPrint(t + 0.04) - sPrint(t)) / 0.04, 0.3, 1.1);   // a longer gold streak when the print runs fast
  if (solidVisible) {
    const lx = -0.62, ly = 0.78;              // key light from the front left (world; the eye is on +y)
    for (let j = 0; j < NR; j++) {
      const done = sNow - j;                    // fraction of ring j printed
      if (done <= 0) break;
      const z0 = (j + 0.5) * LH;
      // after the light sheet passes, the line dissolves into points
      const fadeOut = t >= T_S0 ? 1 - seg(t, tCap(z0), tCap(z0) + 0.35) : 1;
      if (fadeOut <= 0) continue;
      const n = Math.max(1, Math.floor(Math.min(1, done) * RING));
      let px = 0, py = 0, pf = false;
      for (let i = 0; i <= n; i++) {
        const th = TH_START + TAU * Math.min(1, done) * (i / n);
        const z = z0;
        const r = rAt(th, z) + 3;
        // outward normal of the polar curve r(th), rotated to world
        const dr = -Rv(z / H) * LA * LOBES * Math.sin(LOBES * th + TW * z / H);
        const cth = Math.cos(th), sth = Math.sin(th);
        let nx = r * cth + dr * sth, ny = r * sth - dr * cth;
        const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
        const wx = nx * cph - ny * sph, wy = nx * sph + ny * cph;
        proj(th, z, r);
        const X = cam.X, Y = cam.Y;
        const f = cam.faces(r * cth * cph - r * sth * sph, r * cth * sph + r * sth * cph, z, wx, wy, 0);
        if (i > 0 && !(f && pf) && fadeOut > 0.5) BACKS.push(px, py, X, Y);
        if (i > 0 && f && pf) {
          const age = (sNow - (j + i / n * Math.min(1, done)));
          if (age < trail && t < T_P1 + 0.6) gold.push(px, py, X, Y, age);
          else {
            const lam = Math.max(0, wx * lx + wy * ly);
            const lit = clamp(0.16 + 0.84 * lam ** 1.4, 0, 1) * fadeOut;
            LINES[Math.min(NB - 1, Math.floor(lit * NB))].push(px, py, X, Y);
          }
        }
        px = X; py = Y; pf = f;
      }
      if (done < 1 && t < T_P1) {
        const th = TH_START + TAU * done;
        const r = rAt(th, z0) + 3;
        proj(th, z0, r); headX = cam.X; headY = cam.Y; headOk = true;
      }
    }
    if (BACKS.length) {
      g.strokeStyle = rgba('#FFFFFF', 0.07); g.lineWidth = 0.7 * w; g.beginPath();
      for (let i = 0; i < BACKS.length; i += 4) { g.moveTo(BACKS[i], BACKS[i + 1]); g.lineTo(BACKS[i + 2], BACKS[i + 3]); }
      g.stroke();
    }
    g.lineWidth = 1.35 * w;
    for (let k = 0; k < NB; k++) {
      const a = LINES[k]; if (!a.length) continue;
      const v = (k + 0.5) / NB;
      g.strokeStyle = `rgba(${Math.round(150 + 92 * v)},${Math.round(150 + 92 * v)},${Math.round(150 + 92 * v)},${0.25 + 0.7 * v})`;
      g.beginPath(); let lx2 = NaN, ly2 = NaN;
      for (let i = 0; i < a.length; i += 4) { if (a[i] !== lx2 || a[i + 1] !== ly2) g.moveTo(a[i], a[i + 1]); g.lineTo(a[i + 2], a[i + 3]); lx2 = a[i + 2]; ly2 = a[i + 3]; }
      g.stroke();
    }
    // hot bead: the last half ring, gold, brightest at the nozzle
    if (gold.length) {
      g.lineWidth = 1.8 * w;
      for (let i = 0; i < gold.length; i += 5) {
        const age = gold[i + 4];
        g.strokeStyle = rgba(COL.gold, clamp(1 - age / trail) * 0.9 + 0.1);
        g.beginPath(); g.moveTo(gold[i], gold[i + 1]); g.lineTo(gold[i + 2], gold[i + 3]); g.stroke();
      }
    }
  }

  // ---- particles
  for (const b of BLUE) b.length = 0; for (const b of GOLD) b.length = 0; for (const m of MIX) for (const b of m) b.length = 0;
  const dir = [-Math.sin(CAM_AZ), -Math.cos(CAM_AZ)];     // direction from the stereo camera into the scene (world, horizontal)
  for (const p of P) {
    // lifetime: captured at p.tc (in the previous loop, so wrap), absorbed by the nozzle at p.tp
    let since = t - p.tc; if (since < 0) since += DURATION;    // time since capture
    const alive = p.kind === 0 ? (t < p.tp || t >= p.tc) : (t >= p.tg && t < p.tp);
    if (!alive) continue;
    let r, z, th = t >= p.tc && p.kind === 0 ? p.th - TURN : p.th, col, a = 1;
    const zr = (p.j + 0.5) * LH;
    if (p.kind === 0) {
      const noise = p.dn * (0.12 + 0.88 * (1 - E.out3(since / (T_SET + DURATION - T_S1))));
      const m = t < T_P0 + 1 ? E.io3(seg(t, p.ts, p.ts + 1.0)) : (t >= p.tc ? 0 : 1);
      z = lerp(p.zm, zr, m);
      r = rAt(th, z) + noise * (1 - m) * 0.6 + 4;
      col = m;                                            // 0 blue .. 1 gold
      a = Math.min(1, since / 0.25 + (t < p.tc ? 1 : 0));
      // depth noise along the camera ray: push the point along the (fixed) camera direction
      proj(th, z, r);
      if (m < 1) {
        const k = noise * (1 - m);
        cam.p(rx(th, r) + dir[0] * k, ry(th, r) + dir[1] * k, z);
      }
    } else {
      z = zr; r = rAt(th, z) + 4; col = 1;
      a = clamp((t - p.tg) / 0.6);
      proj(th, z, r);
    }
    // absorbed: a short flare just before the nozzle reaches it
    const toP = p.tp - t;
    let s = Math.max(1.9, 1.7 * w) * p.sz;
    if (t >= T_P0 && toP < 0.12 && toP >= 0) { s *= 1 + (0.12 - toP) * 8; }
    const da = depthA(cam.D) * a;
    const k = Math.min(NB - 1, Math.floor(da * NB));
    if (k <= 0) continue;
    const ci = col <= 0.02 ? -1 : col >= 0.98 ? 4 : Math.min(3, Math.floor(col * 4));
    const arr = ci < 0 ? BLUE[k] : ci === 4 ? GOLD[k] : MIX[ci][k];
    arr.push(cam.X - s / 2, cam.Y - s / 2, s);
  }
  g.globalCompositeOperation = 'lighter';
  const fill = (arr, css, k) => { if (!arr.length) return; g.fillStyle = css; g.beginPath(); for (let i = 0; i < arr.length; i += 3) g.rect(arr[i], arr[i + 1], arr[i + 2], arr[i + 2]); g.fill(); };
  for (let k = 1; k < NB; k++) {
    const al = 0.16 + 0.74 * (k + 0.5) / NB;
    fill(BLUE[k], rgba(COL.blue, al));
    fill(GOLD[k], rgba(COL.gold, al));
    for (let c = 0; c < 4; c++) {
      const m = (c + 0.5) / 4;
      const R = Math.round(lerp(163, 242, m)), G = Math.round(lerp(200, 193, m)), B = Math.round(lerp(255, 78, m));
      fill(MIX[c][k], `rgba(${R},${G},${B},${al})`);
    }
  }
  g.globalCompositeOperation = 'source-over';

  // ---- light sheet (rescan): a blue contour at the sheet height, with a soft band above it
  if (t >= T_S0 - 0.05 && t <= T_S1 + 0.25) {
    const z = sweepZ(t), fa = Math.min(seg(t, T_S0 - 0.05, T_S0 + 0.2), 1 - seg(t, T_S1, T_S1 + 0.25));
    g.strokeStyle = rgba(COL.blue, 0.85 * fa); g.lineWidth = 1.2 * w; g.beginPath();
    for (let i = 0; i <= 96; i++) { const th = TAU * i / 96; proj(th, z, rAt(th, z) + 8); i ? g.lineTo(cam.X, cam.Y) : g.moveTo(cam.X, cam.Y); }
    g.stroke();
    // the sheet itself: a thin plane edge running out to both sides
    proj(0, z, 0); const cy = cam.Y;
    const gr = g.createLinearGradient(L.focus.x0 - 200 * w, 0, L.focus.x1 + 100 * w, 0);
    gr.addColorStop(0, rgba(COL.blue, 0)); gr.addColorStop(0.5, rgba(COL.blue, 0.35 * fa)); gr.addColorStop(1, rgba(COL.blue, 0));
    g.strokeStyle = gr; g.lineWidth = 0.7 * w; g.beginPath(); g.moveTo(L.focus.x0 - 200 * w, cy); g.lineTo(L.focus.x1 + 100 * w, cy); g.stroke();
  }

  // ---- deviation ticks: appear with the scan, hold through the measure phase, cleared when the plan replaces the row
  const face = (Math.PI / 2 - CAM_AZ) - PH_CAP;
  for (const k of TK) {
    const tc = tCap(k.z);
    let u = t - tc; if (u < 0) u += DURATION;
    const off = T_SL0 + 1.5 * (k.z / H) + 0.3;              // cleared as the plan reaches its row
    let life = (t >= tc ? u : u) ; const until = (off - tc + DURATION) % DURATION;
    if (life > until) continue;
    const grow = E.outBack(seg(life, 0.05, 0.4)), shrink = 1 - seg(life, until - 0.35, until);
    const th = face + k.a + (t < tc ? TURN : 0), r = rAt(th, k.z);
    const L2 = 46 * grow * shrink;
    proj(th, k.z, r + 6); const ax = cam.X, ay = cam.Y;
    proj(th, k.z, r + 6 + L2); const bx = cam.X, by = cam.Y;
    g.strokeStyle = rgba(COL.white, 0.95 * shrink); g.lineWidth = 1.1 * w;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by);
    const dx = bx - ax, dy = by - ay, dl = Math.hypot(dx, dy) || 1, q = 4 * w * grow;
    g.moveTo(bx - dy / dl * q, by + dx / dl * q); g.lineTo(bx + dy / dl * q, by - dx / dl * q); g.stroke();
    g.beginPath(); g.arc(ax, ay, 2.4 * w, 0, TAU); g.stroke();
  }

  // ---- nozzle: a needle with a gold light at its tip
  if (headOk) {
    const nx = headX, ny = headY;
    // a slender nozzle cone and its feed axis, fading upwards
    const s = 120 * cam.F / DIST, hw = 18 * cam.F / DIST;
    g.fillStyle = '#000'; g.strokeStyle = rgba(COL.ink, 0.9); g.lineWidth = 1.0 * w;
    g.beginPath(); g.moveTo(nx - 1.2 * w, ny - 3 * w); g.lineTo(nx - hw, ny - s); g.lineTo(nx + hw, ny - s); g.lineTo(nx + 1.2 * w, ny - 3 * w); g.closePath(); g.fill(); g.stroke();
    const gr = g.createLinearGradient(0, ny - s, 0, ny - s * 3.2);
    gr.addColorStop(0, rgba(COL.ink, 0.6)); gr.addColorStop(1, rgba(COL.ink, 0));
    g.strokeStyle = gr; g.beginPath(); g.moveTo(nx - hw * 0.55, ny - s); g.lineTo(nx - hw * 0.55, ny - s * 3.2); g.moveTo(nx + hw * 0.55, ny - s); g.lineTo(nx + hw * 0.55, ny - s * 3.2); g.stroke();
    const rr = 22 * w;
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glow(COL.gold), nx - rr, ny - rr, 2 * rr, 2 * rr);
    g.globalCompositeOperation = 'source-over';
  }
}
const rx = (th, r) => { const x = r * Math.cos(th), y = r * Math.sin(th); return x * cph - y * sph; };
const ry = (th, r) => { const x = r * Math.cos(th), y = r * Math.sin(th); return x * sph + y * cph; };

function drawFloor(g, w, ph) {
  // concentric circles every 250 mm out to 3 m, fading with distance; radial lines every 30 deg
  for (let k = 2; k <= 12; k++) {
    const R = k * 250;
    const a = 0.11 * clamp(1.15 - k / 12);
    g.strokeStyle = rgba('#FFFFFF', a); g.lineWidth = 0.6 * w; g.beginPath();
    for (let i = 0; i <= 120; i++) { const q = TAU * i / 120; cam.p(R * Math.cos(q), R * Math.sin(q), 0); i ? g.lineTo(cam.X, cam.Y) : g.moveTo(cam.X, cam.Y); }
    g.stroke();
  }
  g.strokeStyle = rgba('#FFFFFF', 0.06); g.beginPath();
  for (let k = 0; k < 12; k++) { const q = TAU * k / 12; cam.p(500 * Math.cos(q), 500 * Math.sin(q), 0); g.moveTo(cam.X, cam.Y); cam.p(3000 * Math.cos(q), 3000 * Math.sin(q), 0); g.lineTo(cam.X, cam.Y); }
  g.stroke();
  // turntable: two rims and ticks that turn with the vessel
  for (const [R, a] of [[430, 0.4], [452, 0.22]]) {
    g.strokeStyle = rgba(COL.ink, a); g.lineWidth = 0.8 * w; g.beginPath();
    for (let i = 0; i <= 120; i++) { const q = TAU * i / 120; cam.p(R * Math.cos(q), R * Math.sin(q), 0); i ? g.lineTo(cam.X, cam.Y) : g.moveTo(cam.X, cam.Y); }
    g.stroke();
  }
  g.strokeStyle = rgba(COL.ink, 0.32); g.beginPath();
  for (let k = 0; k < 72; k++) {
    const q = TAU * k / 72 + ph, l = k % 6 ? 12 : 26;
    cam.p(430 * Math.cos(q), 430 * Math.sin(q), 0); g.moveTo(cam.X, cam.Y); cam.p((430 - l) * Math.cos(q), (430 - l) * Math.sin(q), 0); g.lineTo(cam.X, cam.Y);
  }
  g.stroke();
}
