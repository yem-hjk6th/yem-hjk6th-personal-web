// Pixel-art story for the hero, drawn entirely in code (no image assets).
//
//   Scene 1  four sensors watch a print: a robot nozzle lays gold beads while
//            robot telemetry, a stereo camera, a bead camera and a nozzle
//            borescope light up in turn and send blue signals off frame.
//   Scene 2  the view steps out (whole-pixel zoom levels) to show that was a
//            monitor in a lab; the monitor then builds a live reconstruction
//            of the print, with a few gold marks where it deviates.
//   Scene 3  hard cut to the goal: a large robot arm printing a ship hull.
//
// One canvas at a low internal resolution (320 x 180), scaled up by CSS with
// image-rendering: pixelated. Capped at 30 fps, paused off screen, and a
// single still of scene 3 under prefers-reduced-motion.

/** Scene lengths in seconds. Tune here; everything else follows. */
export const TIMING = {
  sensors: 4,
  zoomOut: 4,
  goal: 4,
  /** Within zoomOut: seconds spent on each zoom step before the reconstruction. */
  zoomStep: 0.45,
  fps: 30,
};

const W = 320;
const H = 180;

type Ctx = CanvasRenderingContext2D;
interface Palette { bg: string; blue: string; blueDim: string; gold: string; goldDark: string; g1: string; g2: string; g3: string; g4: string }

// ---------- tiny pixel API ----------
const rect = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
/** Bresenham line with square pen of size `s`. */
function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, s = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = col;
  const o = Math.floor(s / 2);
  for (;;) {
    c.fillRect(x0 - o, y0 - o, s, s);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// 3x5 pixel font, rows top to bottom.
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', ' ': '000000000000000',
};
function text(c: Ctx, s: string, x: number, y: number, col: string) {
  c.fillStyle = col;
  let cx = Math.round(x);
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') c.fillRect(cx + (i % 3), Math.round(y) + Math.floor(i / 3), 1, 1);
    cx += 4;
  }
}
const textWidth = (s: string) => s.length * 4 - 1;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---------- scene 1: four sensors watch a print ----------
const BED = { x: 92, y: 146, w: 136 };
const PART = { x0: 122, x1: 198, layerH: 3, startLayers: 5, addLayers: 9 };

function drawPrint(c: Ctx, p: Palette, t: number) {
  const prog = clamp01(t / TIMING.sensors);
  const total = PART.startLayers + PART.addLayers * prog;
  const done = Math.floor(total);
  const frac = total - done;
  // Bed and legs
  rect(c, BED.x, BED.y, BED.w, 4, p.g2);
  rect(c, BED.x + 6, BED.y + 4, 4, 18, p.g1);
  rect(c, BED.x + BED.w - 10, BED.y + 4, 4, 18, p.g1);
  // Finished layers, alternating shade so the bead lines read
  for (let i = 0; i < done; i++) {
    const y = BED.y - (i + 1) * PART.layerH;
    rect(c, PART.x0, y, PART.x1 - PART.x0, PART.layerH, i % 2 ? p.gold : p.goldDark);
    rect(c, PART.x0 - 1, y + 1, 1, 1, p.goldDark);
    rect(c, PART.x1, y + 1, 1, 1, p.goldDark);
  }
  // Current layer, serpentine: left-to-right on even layers
  const y = BED.y - (done + 1) * PART.layerH;
  const len = (PART.x1 - PART.x0) * frac;
  const ltr = done % 2 === 0;
  const nx = ltr ? PART.x0 + len : PART.x1 - len;
  rect(c, ltr ? PART.x0 : nx, y, len, PART.layerH, done % 2 ? p.gold : p.goldDark);
  return { nx: Math.round(nx), ny: y };
}

function drawRobot(c: Ctx, p: Palette, nx: number, ny: number) {
  const base = { x: 262, y: 146 };
  rect(c, base.x - 4, base.y - 12, 26, 12, p.g2);          // base
  rect(c, base.x, base.y - 18, 18, 6, p.g3);               // turntable
  const sh = { x: base.x + 9, y: base.y - 20 };            // shoulder
  const el = { x: 236, y: 62 };                            // elbow (fixed: reads fine)
  const wr = { x: nx, y: ny - 22 };                        // wrist above the nozzle
  line(c, sh.x, sh.y, el.x, el.y, p.g3, 5);
  line(c, el.x, el.y, wr.x, wr.y, p.g3, 4);
  rect(c, sh.x - 3, sh.y - 3, 7, 7, p.g4);
  rect(c, el.x - 3, el.y - 3, 7, 7, p.g4);
  // Extruder and nozzle
  rect(c, wr.x - 4, wr.y - 2, 9, 14, p.g2);
  rect(c, wr.x - 1, wr.y + 12, 3, 6, p.g3);
  rect(c, wr.x, wr.y + 18, 1, 2, p.gold);
  return { base, wr };
}

interface Sensor { label: string; x: number; y: number; lx: number; ly: number; edge: 'left' | 'right' | 'top' }

function signal(c: Ctx, p: Palette, from: { x: number; y: number }, edge: Sensor['edge'], t: number, on: number) {
  // A thin dim line to the frame edge with bright packets running along it.
  const to = edge === 'left' ? { x: 0, y: from.y } : edge === 'right' ? { x: W - 1, y: from.y } : { x: from.x, y: 0 };
  line(c, from.x, from.y, to.x, to.y, p.blueDim, 1);
  if (on <= 0) return;
  const len = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  for (let k = 0; k < 4; k++) {
    const d = ((t * 60 + k * 18) % len);
    const f = d / len;
    rect(c, from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f, 2, 1, p.blue);
  }
}

function drawScene1(c: Ctx, p: Palette, t: number) {
  c.clearRect(0, 0, W, H);
  const { nx, ny } = drawPrint(c, p, t);
  const { base, wr } = drawRobot(c, p, nx, ny);

  const sensors: Sensor[] = [
    { label: 'ROBOT TELEMETRY', x: base.x + 8, y: base.y - 6, lx: 222, ly: 156, edge: 'right' },
    { label: 'STEREO CAMERA', x: 40, y: 34, lx: 24, ly: 22, edge: 'left' },
    { label: 'BEAD CAMERA', x: 78, y: 128, lx: 20, ly: 108, edge: 'left' },
    { label: 'NOZZLE BORESCOPE', x: wr.x + 7, y: wr.y + 10, lx: wr.x - 8 - textWidth('NOZZLE BORESCOPE'), ly: wr.y + 2, edge: 'top' },
  ];
  const step = TIMING.sensors / 5;

  // Sensor bodies (always drawn, grey until lit)
  sensors.forEach((s, i) => {
    const on = clamp01((t - (i + 0.4) * step) / 0.25);
    const col = on > 0 ? p.blue : p.g3;
    if (i === 0) { rect(c, s.x - 3, s.y - 2, 7, 4, col); }
    if (i === 1) { rect(c, s.x - 8, s.y - 3, 16, 6, p.g2); rect(c, s.x - 6, s.y - 1, 3, 3, col); rect(c, s.x + 3, s.y - 1, 3, 3, col); line(c, s.x, s.y + 3, s.x, s.y + 10, p.g2, 1); }
    if (i === 2) { rect(c, s.x - 5, s.y - 3, 10, 6, p.g2); rect(c, s.x + 3, s.y - 1, 3, 3, col); }
    if (i === 3) { rect(c, s.x - 1, s.y - 8, 2, 12, col); }
    signal(c, p, i === 2 ? { x: s.x - 6, y: s.y } : i === 1 ? { x: s.x - 9, y: s.y } : s, s.edge, t, on);
    if (on > 0) {
      text(c, s.label, Math.max(2, Math.min(s.lx, W - textWidth(s.label) - 2)), s.ly, p.blue);
      if (i === 0) {
        // Telemetry ticks streaming out of the robot controller
        for (let k = 0; k < 10; k++) {
          const h = 1 + ((k * 7 + Math.floor(t * 20)) % 5);
          rect(c, s.x + 8 + k * 4, s.y - h, 2, h, p.blue);
        }
      }
      if (i === 1 || i === 2) {
        // Field of view toward the part
        const tx = (PART.x0 + PART.x1) / 2, ty = BED.y - 20;
        line(c, s.x + (i === 1 ? 0 : 5), s.y + (i === 1 ? 4 : 0), tx, ty, p.blueDim, 1);
      }
    }
  });
}

// ---------- scene 2: zoom out to the lab monitor ----------
const SCREEN = { x: 120, y: 54, w: 80, h: 45 };

function drawLab(c: Ctx, p: Palette) {
  c.clearRect(0, 0, W, H);
  rect(c, 0, 122, W, 1, p.g1);                                   // wall/desk line
  rect(c, 40, 120, 240, 4, p.g2);                                // desk top
  rect(c, 52, 124, 4, 40, p.g1); rect(c, 264, 124, 4, 40, p.g1); // desk legs
  rect(c, SCREEN.x - 4, SCREEN.y - 4, SCREEN.w + 8, SCREEN.h + 8, p.g2); // bezel
  rect(c, 156, 103, 8, 14, p.g2); rect(c, 146, 116, 28, 4, p.g2);       // stand
  rect(c, 214, 112, 34, 4, p.g2);                                // keyboard
  for (let k = 0; k < 7; k++) rect(c, 216 + k * 4, 113, 2, 1, p.g1);
  // Window into the robot cell, with the robot's outline
  rect(c, 30, 30, 62, 50, p.g1); c.clearRect(32, 32, 58, 46);
  line(c, 70, 74, 58, 48, p.g2, 2); line(c, 58, 48, 48, 60, p.g2, 2); rect(c, 66, 72, 10, 6, p.g2);
  // Shelf with boxes
  rect(c, 228, 46, 52, 2, p.g2); rect(c, 232, 38, 10, 8, p.g1); rect(c, 246, 40, 8, 6, p.g1); rect(c, 258, 36, 12, 10, p.g1);
}

/** Layered point cloud of the print building up on the monitor. */
function drawReconstruction(c: Ctx, p: Palette, prog: number) {
  const s = SCREEN;
  rect(c, s.x, s.y, s.w, s.h, p.bg);
  text(c, 'LIVE SCAN', s.x + 3, s.y + 3, p.g3);
  const rows = 12, built = Math.floor(rows * prog);
  for (let r = 0; r < built; r++) {
    const y = s.y + s.h - 6 - r * 2.5;
    // An isometric-ish ring of points per layer
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const x = s.x + s.w / 2 + Math.cos(a) * 20;
      const yy = y + Math.sin(a) * 4;
      const deviates = (r === 4 && k > 3 && k < 7) || (r === 8 && k > 17 && k < 20) || (r === 10 && k === 11);
      if (deviates) rect(c, x, yy - 1, 2, 2, p.gold);
      else rect(c, x, yy, 1, 1, Math.sin(a) > 0 ? p.blue : p.blueDim);
    }
  }
  // Scan line sweeping over the newest layer
  if (built < rows) rect(c, s.x + 8, s.y + s.h - 6 - built * 2.5, s.w - 16, 1, p.blue);
}

function drawScene2(c: Ctx, p: Palette, t: number, lab: Ctx, shot: Ctx) {
  const zooms = [4, 3, 2, 1];
  const zi = Math.min(zooms.length - 1, Math.floor(t / TIMING.zoomStep));
  const z = zooms[zi];
  if (z === 4) {
    // Full view: still the scene-1 picture, about to step out
    drawScene1(c, p, TIMING.sensors);
    return;
  }
  // Build the lab at world resolution, with the monitor content inside it
  drawLab(lab, p);
  const zoomEnd = TIMING.zoomStep * zooms.length;
  if (t < zoomEnd + 0.3) {
    drawScene1(shot, p, TIMING.sensors);
    rect(lab, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, p.bg);
    lab.imageSmoothingEnabled = false;
    lab.drawImage(shot.canvas, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
  } else {
    drawReconstruction(lab, p, clamp01((t - zoomEnd - 0.3) / (TIMING.zoomOut - zoomEnd - 0.5)));
  }
  // Show it at whole-pixel scale z, centred on the monitor
  const cw = W / z, ch = H / z;
  const cx = Math.min(W - cw, Math.max(0, SCREEN.x + SCREEN.w / 2 - cw / 2));
  const cy = Math.min(H - ch, Math.max(0, SCREEN.y + SCREEN.h / 2 - ch / 2));
  c.clearRect(0, 0, W, H);
  c.imageSmoothingEnabled = false;
  c.drawImage(lab.canvas, cx, cy, cw, ch, 0, 0, W, H);
}

// ---------- scene 3: the goal, a ship hull at full scale ----------
function drawScene3(c: Ctx, p: Palette, t: number) {
  c.clearRect(0, 0, W, H);
  const horizon = 132;
  rect(c, 0, horizon, W, 1, p.g2);
  const prog = clamp01(t / TIMING.goal);
  const layers = 18 + Math.floor(prog * 14), lh = 2;
  const baseY = 150;
  let headX = 0, headY = 0;
  for (let i = 0; i <= layers; i++) {
    const y = baseY - i * lh;
    // Side view of a hull: flat keel, bow rising and flaring to the left, near-vertical stern
    const left = 70 - i * 1.6 + Math.max(0, 8 - i) * 2.2;
    const right = 232 + i * 0.25;
    const isTop = i === layers;
    const frac = isTop ? (t * 2.2) % 1 : 1;
    const x1 = left + (right - left) * frac;
    rect(c, left, y, x1 - left, lh, i % 2 ? p.gold : p.goldDark);
    if (isTop) { headX = x1; headY = y; }
  }
  // Large robot arm on a base to the right
  const base = { x: 286, y: 150 };
  rect(c, base.x - 14, base.y - 16, 30, 16, p.g2);
  rect(c, base.x - 8, base.y - 24, 18, 8, p.g3);
  const sh = { x: base.x + 1, y: base.y - 26 }, el = { x: 270, y: 36 };
  line(c, sh.x, sh.y, el.x, el.y, p.g3, 7);
  line(c, el.x, el.y, headX, headY - 16, p.g3, 5);
  rect(c, sh.x - 4, sh.y - 4, 9, 9, p.g4); rect(c, el.x - 4, el.y - 4, 9, 9, p.g4);
  rect(c, headX - 4, headY - 18, 8, 14, p.g2);
  rect(c, Math.round(headX), headY - 4, 1, 3, p.gold);
}

// ---------- runner ----------
const css = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** Black, greys, blue for sensing and data, gold for material being printed. */
const palette = (): Palette => ({
  bg: css('--bg', '#000000'), blue: css('--blue', '#A3C8FF'), gold: css('--gold', '#F2C14E'),
  blueDim: '#2E4466', goldDark: '#B38A2C', g1: '#1E1E1E', g2: '#3C3C3C', g3: '#7A7A7A', g4: '#B5B5B5',
});

export function mountPixelStory(canvas: HTMLCanvasElement) {
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return () => {};
  c.imageSmoothingEnabled = false;
  const off = (w: number, h: number) => {
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const x = o.getContext('2d')!; x.imageSmoothingEnabled = false; return x;
  };
  const lab = off(W, H), shot = off(W, H);
  const p = palette();
  const loop = TIMING.sensors + TIMING.zoomOut + TIMING.goal;

  const draw = (t: number) => {
    const s = t % loop;
    if (s < TIMING.sensors) drawScene1(c, p, s);
    else if (s < TIMING.sensors + TIMING.zoomOut) drawScene2(c, p, s - TIMING.sensors, lab, shot);
    else drawScene3(c, p, s - TIMING.sensors - TIMING.zoomOut);
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drawScene3(c, p, TIMING.goal * 0.999); // one still: the goal, almost finished
    canvas.dataset.ready = 'true';
    return () => {};
  }

  let raf = 0, visible = true, last = 0, elapsed = 0, prev = performance.now();
  const frameMs = 1000 / TIMING.fps;
  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(100, now - prev); // do not jump after a pause
    prev = now;
    elapsed += dt;
    if (now - last >= frameMs - 1) { last = now; draw(elapsed / 1000); }
    if (visible) raf = requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(tick); }
  });
  io.observe(canvas);
  draw(0);
  canvas.dataset.ready = 'true';
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); io.disconnect(); };
}
