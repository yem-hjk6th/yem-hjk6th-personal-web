// RSI pixel story, live. Three scenes on a 12 s loop (30 steps a second), cues on a 0.5 s grid:
//   1 sensors (0-4 s)  : a nozzle lays a bead; four sensors (robot telemetry RSI, stereo camera, bead camera,
//                        nozzle borescope) stream data from frame 0, and each one "looks" in turn, one per second;
//   2 monitor (4-8 s)  : the view steps out (4.0, 4.5 s) to a lab monitor; a blue scan line wipes the camera image
//                        into a live 3D reconstruction (5.0-5.5 s), which builds to 7.0 s and holds; at 7.5 s the
//                        view steps in until the screen fills the frame;
//   3 hull (8-12 s)    : match cut (shape and place) from the scan to the gold hull at z 2, stepping out at 8.5 s
//                        to a large arm on a rail printing it, a person for scale; the hull
//                        holds at 10-11 s, then the view steps in on the nozzle (11.0 s) and match-cuts (11.5 s) to the
//                        close-up of scene 1 with its sensors dark; they switch on at 0 s, so the seam itself is seamless.
// Started as a port of website_261031/anim_compare/animate/piece/src/scenes.js; round changes in W20_hero/ROUNDS.md.
// Layout: the key action is authored in a KW x KH box (pixel coords) that the player places in the free zone next to
// the name; everything outside that box is "world" (dot grid, bed, room, floor) and stretches to whatever aspect the
// hero has. L = { W, H, kx, ky } (buffer size and key-box origin, in pixels).
import { rgb, clamp, TAU, zoomed, prect, pset, pline, dline, pellipse, pcircle, ppoly, sprite, pixText } from './pixel.js';

export const KW = 208, KH = 128, DURATION = 12, FPS = 30;
export const STILL_T = 7.2;   // reduced motion: the room and monitor with the finished reconstruction
const K = rgb('#000000'), G1 = rgb('#1A1A1A'), G2 = rgb('#3A3A3A'), G3 = rgb('#6E6E6E'), G4 = rgb('#B4B4B4'), G5 = rgb('#F2F2F2');
const BL = rgb('#A3C8FF'), GD = rgb('#F2C14E');
let B = 0;   // boil index, 12 per second

// ------------------------------------------------------------ scene 1: four sensors watch a print
// authored on a 52 x 32 grid drawn at z = 4 (scene 2 redraws it at z = 3 and 2 inside the monitor)
const SENS = [
  { n: 'RSI', cy: 3, spr: ['.a.a.a.a.', 'aaaaaaaaa', 'abb.b.bba', 'aaaaaaaaa', '.a.a.a.a.'] },
  { n: 'STEREO', cy: 11, spr: ['aaaaaaaaa', 'aabbaabba', 'aabbaabba', 'aaaaaaaaa'] },
  { n: 'BEAD', cy: 19, spr: ['aaaaaaaaa', 'aaabbbaaa', 'aaabbbaaa', 'aaabbbaaa', 'aaaaaaaaa'] },
  { n: 'BORE', cy: 27, spr: ['aaaaaaabb', 'aaaaaaabb', 'aaaaaaabb'] },
];
const SX = 37;   // sensor column (grid x)
// r2: every sensor streams from frame 0; the one that "looks" (white, with its rays) steps on a 1 s beat
// r6: t < 0 is the pre-roll before the seam (11.5-12 s drawn as -0.5..0 s): sensors dark, they switch on at 0
const sensState = (t, i) => ({ t0: i, lit: t >= 0, act: t >= i && t < i + 1 });
function sc1(t, z, tx, ty, L, inMonitor) {
  const nx = 8 + Math.round(22 * Math.min(1, t / 5.4));
  // grid extent of the visible area, for the world parts (dot grid, bed, data lines)
  const gx0 = inMonitor ? 0 : Math.floor(-L.kx / 4) - 1, gx1 = inMonitor ? 52 : Math.ceil((L.W - L.kx) / 4) + 1;
  const gy0 = inMonitor ? 0 : Math.floor(-L.ky / 4) - 1, gy1 = inMonitor ? 32 : Math.ceil((L.H - L.ky) / 4) + 1;
  zoomed(z, tx, ty, () => {
    if (inMonitor) prect(0, 0, 52, 32, K);
    for (let x = gx0 - (((gx0 % 8) + 8) % 8) + 4; x < gx1; x += 8) for (let y = gy0 - (((gy0 % 8) + 8) % 8) + 4; y < gy1; y += 8) pset(x, y, G1);
    // bed (runs on to the left edge) and the finished first layer
    prect(gx0, 27, 35 - gx0, 1, G4); prect(gx0, 28, 35 - gx0, 1, G3); prect(gx0, 29, 35 - gx0, 3, G2);   // ground ends at the key-box bottom
    prect(4, 24, 29, 3, GD);
    // the second bead grows behind the nozzle
    for (let x = 4; x <= nx; x++) { const h = Math.min(3, 1 + ((nx - x) >> 1)); prect(x, 24 - h, 1, h, GD); }
    // nozzle (side view, close up) and its robot flange
    for (let o = -1; o <= 1; o++) pline(nx + o, -1, nx + 7 + o, -11, G2);
    const rows = [[-1, 3, 5], [4, 10, 4], [11, 14, 3], [15, 17, 2], [18, 20, 1]];
    rows.forEach(([y0, y1, hw]) => {
      prect(nx - hw, y0, 2 * hw + 1, y1 - y0 + 1, G3);
      prect(nx - hw, y0, 1, y1 - y0 + 1, G4); prect(nx + hw, y0, 1, y1 - y0 + 1, G2);
    });
    prect(nx - 5, 3, 11, 1, G2);
    for (let y = 4; y <= 19; y++) if ((y + Math.floor(t * 14)) % 3) pset(nx, y, GD);   // gold flowing inside
    pset(nx, 20, GD);
    // sensors
    SENS.forEach((s, i) => {
      const { t0, lit, act } = sensState(t, i);
      const ax = SX, ay = s.cy - Math.floor(s.spr.length / 2);
      sprite(s.spr, { a: act ? G5 : lit ? BL : G3, b: act ? BL : lit ? G1 : G2 }, ax, ay);
      pline(SX + 9, s.cy, gx1, s.cy, lit ? BL : G1);
      if (lit) {
        const f = Math.floor(t * 24) + 5 * i, x0 = SX + 9, span = Math.max(6, gx1 - x0);
        for (let k = 0; k < 3; k++) pset(x0 + (k * 6 + f) % span, s.cy, G5);
        if (i === 0) for (let k = 0; k < 4; k++) { const x = x0 + (k * 4 + f * 2) % span; pset(x, s.cy + 1, BL); pset(x + 1, s.cy + 1, BL); pset(x0 + (x - x0 + 7) % span, s.cy - 1, G5); }
      }
      if (act) {   // what it looks at
        const ph = Math.floor(t * 20);
        if (i === 0) dline(SX - 1, s.cy, nx + 1, 1, BL, ph);
        if (i === 1) { dline(SX - 1, s.cy, 5, 26, BL, ph); dline(SX - 1, s.cy, 32, 26, BL, ph); }
        if (i === 2) dline(SX - 1, s.cy, nx - 3, 22, BL, ph);
        if (i === 3) dline(SX - 1, s.cy, nx + 1, 19, BL, ph);
      }
    });
  }, inMonitor ? [L.kx + tx, L.ky + ty, 52 * z, 32 * z] : null);
  // tiny labels on the output grid (clipped to the screen inside the monitor)
  zoomed(1, 0, 0, () => SENS.forEach((s, i) => {
    const { lit, act } = sensState(t, i);
    pixText(s.n, Math.round(tx + z * (SX + 4.5)), Math.round(ty + z * (s.cy + 3) + 1), act ? G5 : lit ? BL : G3, { align: 'center' });
  }), inMonitor ? [L.kx + tx, L.ky + ty, 52 * z, 32 * z] : null);
}
function scene1(t, L) { sc1(t, 4, 0, 0, L, false); }

// ------------------------------------------------------------ scene 2: step out to the monitor, live reconstruction
const MON = { 3: [26, 8, 120], 2: [52, 14, 100] };   // z: [screen x, screen y, desk y] in key coords
function room(z, L, bare) {   // bare: the 2x step-in keeps only wall, monitor and screen
  const [tx, ty, dY] = MON[z], pad = 7, sw = 52 * z, sh = 32 * z, bx = tx - pad, by = ty - pad, bw = sw + 2 * pad, bh = sh + 2 * pad;
  const wx0 = -L.kx, wx1 = L.W - L.kx, wy0 = -L.ky;
  prect(wx0, wy0, wx1 - wx0, dY - wy0, G1);   // wall
  if (z === 2 && !bare) {
    for (let x = -64; x < -8; x += 6) for (let y = 8; y < 80; y += 6) pset(x, y, G2);   // pegboard
    prect(170, 50, 40, 2, G3); prect(174, 40, 7, 10, G2); prect(174, 40, 7, 1, G3); prect(184, 40, 7, 10, GD); prect(184, 44, 7, 1, K); prect(194, 37, 13, 13, G3); prect(194, 37, 13, 2, G4);
  }
  prect(wx0, dY, wx1 - wx0, 2, G4); prect(wx0, dY + 2, wx1 - wx0, Math.max(0, KH - dY - 2), G2);   // desk front ends at the key-box bottom
  // lamp, printed hull model, keyboard, mouse, mug
  if (!bare) props(dY);
  // the monitor: stand, bezel, power LED
  monitor(tx, ty, sw, sh, bx, by, bw, bh, dY);
}
function props(dY) {
  prect(4, dY - 2, 12, 2, G3); pline(9, dY - 2, 14, dY - 24, G4); pline(14, dY - 24, 28, dY - 30, G4); ppoly([[26, dY - 33], [36, dY - 30], [30, dY - 26]], G4);
  for (let l = 0; l < 5; l++) { const xs = 30 - Math.floor(l * 0.8), xe = 42 + Math.floor(l * 0.8); prect(xs, dY - 3 * (l + 1), xe - xs, 2, GD); }
  prect(116, dY - 2, 40, 2, G3); for (let x = 118; x < 154; x += 3) pset(x, dY - 2, G5);
  prect(160, dY - 2, 5, 2, G3);
  prect(176, dY - 9, 9, 9, G4); prect(185, dY - 7, 2, 4, G4); pset(186, dY - 5, G1); prect(176, dY - 9, 9, 1, G2);
  if (B % 8 < 4) { pset(179, dY - 12, G3); pset(181, dY - 15, G3); } else { pset(180, dY - 12, G3); pset(179, dY - 15, G3); }
}
function monitor(tx, ty, sw, sh, bx, by, bw, bh, dY) {
  const cx = tx + sw / 2;
  prect(cx - 6, by + bh, 12, dY - by - bh, G2); prect(cx - 6, by + bh, 1, dY - by - bh, G3);
  prect(cx - 18, dY - 3, 36, 3, G3); prect(cx - 18, dY - 1, 36, 1, G2);
  prect(bx, by, bw, bh, G2); prect(bx, by, bw, 1, G3); prect(bx, by, 1, bh, G3); prect(bx, by + bh - 1, bw, 1, G1); prect(bx + bw - 1, by, 1, bh, G1);
  if (B % 30 < 20) pset(cx, by + bh - 3, BL);
}
const RCN = { N: 16, M: 40 };
function recon(t, sx, sy) {
  prect(sx, sy, 104, 64, K);
  const cx = sx + 52, base = sy + 54, p = clamp((t - 5.5) / 1.5), built = Math.pow(p, 0.9) * RCN.N;
  pellipse(cx, base + 3, 44, 7, G1, { ring: 1 }); pellipse(cx, base + 3, 30, 5, G1, { ring: 1 });
  pline(cx - 44, base + 3, cx + 44, base + 3, G1); pline(cx, base - 6, cx, base + 9, G1);
  for (const [a, b] of [[0, 0], [98, 0], [0, 59], [98, 59]]) { prect(sx + a, sy + b, 6, 1, G3); prect(sx + a + (a ? 5 : 0), sy + b, 1, 5, G3); }
  const prof = (l) => 13 + 17 * Math.pow(l / (RCN.N - 1), 1.3);   // r7: flared like the hull of scene 3 (was a bulging pot)
  const pt = (l, k) => { const th = TAU * k / RCN.M, rx = prof(l); return [cx + rx * Math.cos(th), base - 3 * l - 3 + rx * 0.28 * Math.sin(th), Math.sin(th) > 0]; };
  const top = Math.ceil(built) - 1;
  for (let l = 1; l <= top; l++) for (let k = 0; k < RCN.M; k += 3) { const a = pt(l - 1, k), b = pt(l, k); if (a[2]) pline(a[0], a[1], b[0], b[1], G2); }
  for (let l = 0; l <= top; l++) {
    const frac = Math.min(1, built - l), n = Math.floor(RCN.M * frac);
    for (let k = 0; k < n; k++) { const q = pt(l, k); pset(q[0], q[1], l === top && frac < 1 ? G5 : q[2] ? BL : G3); }
  }
  if (p < 1 && top >= 0) pellipse(cx, base - 3 * top - 3, Math.round(prof(top)), Math.round(prof(top) * 0.28), G4, { ring: 1 });
  [[4, 7], [8, 15], [11, 4], [13, 11]].forEach(([l, k], i) => {   // deviations
    if (l >= top - 1 && p < 1) return;
    const q = pt(l, k), x = Math.round(q[0]), y = Math.round(q[1]);
    if ((B + i * 3) % 8 < 5) { prect(x - 1, y, 3, 1, G5); prect(x, y - 1, 1, 3, G5); } else pset(x, y, G5);   // r9: white, gold = material only
  });
  prect(sx + 4, sy + 60, 96, 2, G1); prect(sx + 4, sy + 60, Math.round(96 * p), 2, BL);
}
function scene2(t, L) {
  // r8: at 7.5 s the view steps in until the monitor's screen fills the key box (scan at 2x, black around it),
  // so the 8.0 s cut to the hull goes black -> black at a similar size
  if (t >= 7.5) { zoomed(2, -2 * MON[2][0], -2 * MON[2][1], () => scene2body(t, L, 2, true), [0, 0, L.W, L.ky + KH]); return; }
  scene2body(t, L, t < 4.5 ? 3 : 2);   // r5: step-out cuts on the beat, 4.0 and 4.5 s (were 4.2 and 4.7)
}
function scene2body(t, L, z, bare) {
  room(z, L, bare);
  const [tx, ty] = MON[z];
  if (t < 5.0) sc1(t, z, tx, ty, L, true);
  else if (t < 5.5) {   // r3: a blue scan line wipes the camera view down into the reconstruction (was: glitch bars)
    const yl = Math.round(64 * (t - 5.0) / 0.5), X = L.kx + tx, Y = L.ky + ty;
    zoomed(1, 0, 0, () => recon(t, tx, ty), [X, Y, 104, yl]);
    zoomed(1, 0, 0, () => sc1(t, z, tx, ty, L, true), [X, Y + yl, 104, 64 - yl]);
    prect(tx, ty + yl, 104, 1, BL); prect(tx, ty + yl - 1, 104, 1, G5);
  } else recon(t, tx, ty);
}

// ------------------------------------------------------------ scene 3: the goal, a large arm printing a ship hull
const PERSON = ['.aaa.', '.aaa.', '.aaa.', '..a..', 'aaaaa', 'a.a.a', '..a..', '..a..', '.a.a.', '.a.a.', '.a.a.'];
function thick(x0, y0, x1, y1, w) {
  const horiz = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  for (let o = 0; o < w; o++) {
    const d = o - Math.floor(w / 2), c = o === 0 ? G5 : o === w - 1 ? G3 : G4;
    if (horiz) pline(x0, y0 + d, x1, y1 + d, c); else pline(x0 + d, y0, x1 + d, y1, c);
  }
}
// r4: the hull is built in 10 layers (r5: by 10.0 s); the nozzle then starts layer 11 on the left, moving right at the
// close-up's speed, while the view steps in (z 2 at 11.0 s). r6: at 11.5 s the tip sits exactly where scene 1's nozzle
// opens and the picture match-cuts to the close-up (sensors still dark), which runs on through the seam.
const H3 = { FL: 124, y0: 121, N: 11, LH: 4, SPEED: 4.07 };   // SPEED: scene-1 nozzle speed / 4 (px per s)
const xsOf = (l) => Math.round(110 - 30 * Math.pow((l + 0.5) / H3.N, 0.9)), xeOf = (l) => Math.round(150 + 40 * Math.pow((l + 0.5) / H3.N, 1.7));
const ytop = (l) => H3.y0 - H3.LH * l - 3;
function s3state(tt) {
  const last = H3.N - 1;
  // r5: the cut lands mid-print (3 layers done), layers 4-10 by 10.0 s, a still 1 s hold with the nozzle at the
  // start of the last layer, then the last layer starts at 11.0 s with the step-in
  const q = tt < 2 ? 6 + clamp(tt / 2) * (last - 6) : tt < 3 ? last : last + Math.min(0.99, (tt - 3) * H3.SPEED / (xeOf(last) - xsOf(last)));   // r7: opens with 6 layers
  const Lr = Math.min(last, Math.floor(q)), u = q - Lr, dir = Lr % 2 === 0 ? 1 : -1;
  const a = xsOf(Lr), b = xeOf(Lr), nxx = Math.round(dir > 0 ? a + u * (b - a) : b - u * (b - a));
  return { q, Lr, u, dir, nxx, tipX: q <= 0 ? xsOf(0) : nxx, tipY: ytop(Lr) - 1 };
}
function scene3(t, L) {
  const tt = t - 8, st = s3state(tt);
  const z = tt < 0.5 || tt >= 3.0 ? 2 : 1;
  let ox = 0, oy = 0;
  if (z > 1 && tt >= 3.0) {   // r6: the z 2 step-in puts the tip at the 11.5 s cut exactly on scene 1's tip, key (34, 82)
    const e = s3state(3.5);
    ox = 34 - 2 * e.tipX; oy = 82 - 2 * e.tipY;
  } else if (z > 1) {   // r7: opens at z 2 with the hull where the monitor's scan sat, steps out at 8.5 s
    const top = ytop(6), cx = (xsOf(6) + xeOf(6)) / 2, cy = (top + H3.FL) / 2;
    ox = Math.round(104 - 2 * cx); oy = Math.round(57 - 2 * cy);   // r8: centre of the 2x scan
  }
  const view = { wx0: Math.floor((-L.kx - ox) / z) - 1, wx1: Math.ceil((L.W - L.kx - ox) / z) + 1 };
  zoomed(z, ox, oy, () => draw3(st, view), [0, 0, L.W, L.ky + KH]);
}
function draw3(st, { wx0, wx1 }) {
  const { FL, y0, N } = H3, { q, Lr, dir, nxx, tipX, tipY } = st;
  prect(wx0, FL, wx1 - wx0, 1, G2); prect(wx0, FL + 1, wx1 - wx0, KH - FL - 1, G1);   // floor ends at the key-box bottom
  prect(52, y0, 146, 3, G3); prect(52, y0, 146, 1, G4);
  for (let l = 0; l < N; l++) {
    const xs = xsOf(l), xe = xeOf(l);
    if (l < Lr) prect(xs, ytop(l), xe - xs, 3, GD);
    else if (l === Lr && q > 0) {
      const a = dir > 0 ? xs : nxx, b = dir > 0 ? nxx : xe;
      prect(a, ytop(l), b - a, 3, GD);
      if (dir > 0) prect(Math.max(a, b - 5), ytop(l), Math.min(5, b - a), 1, G5); else prect(a, ytop(l), Math.min(5, b - a), 1, G5);
    }
  }
  sprite(PERSON, { a: G4 }, 6, FL - 11);
  // the arm on its rail: shoulder follows the nozzle, two-link IK
  const bx = Math.round(0.55 * tipX - 9), sx = bx, sy = 94, wx = tipX, wy = tipY - 11;
  const dx = wx - sx, dy = wy - sy, dd = Math.hypot(dx, dy), d = Math.min(dd, 105), L1 = 52, L2 = 56;
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a)), ux = dx / dd, uy = dy / dd;
  const ex = Math.round(sx + a * ux + h * uy), ey = Math.round(sy + a * uy - h * ux);
  prect(wx0, FL - 1, wx1 - wx0, 1, G3);
  prect(bx - 9, FL - 6, 18, 5, G2); prect(bx - 9, FL - 6, 18, 1, G3);
  prect(bx - 4, sy, 9, FL - 6 - sy, G3); prect(bx - 4, sy, 2, FL - 6 - sy, G4);
  thick(sx, sy, ex, ey, 5); thick(ex, ey, wx, wy, 4);
  for (const [jx, jy, r] of [[sx, sy, 5], [ex, ey, 4], [wx, wy, 3]]) { pcircle(jx, jy, r, G2); pcircle(jx, jy, r - 2, G4); pcircle(jx, jy, 1, G2); }
  prect(wx - 2, wy + 2, 4, 7, G3); prect(wx - 1, wy + 9, 3, 2, G4); pset(wx, tipY, GD);
  prect(wx + 3, wy + 1, 4, 3, G2); pset(wx + 4, wy + 2, B % 10 < 7 ? BL : G2);   // a sensor on the wrist
}

// ------------------------------------------------------------ entry point
export function renderScene(t, L) {
  B = Math.floor(t * 12);
  zoomed(1, L.kx, L.ky, () => {
    if (t < 4) scene1(t, L);
    else if (t < 8) scene2(t, L);
    else if (t < 11.5) scene3(t, L);
    else sc1(t - 12, 4, 0, 0, L, false);   // r6: match cut to the close-up, which runs on through the seam
  });
}
