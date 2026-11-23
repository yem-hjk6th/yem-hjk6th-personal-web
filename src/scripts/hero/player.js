// Live pixel hero: sizes a low-res buffer to the hero, places the key action in the free zone next to
// the name, darkens what sits under the text, and plays the 12 s loop at 30 steps a second.
// Pauses off screen (IntersectionObserver) and in hidden tabs; prefers-reduced-motion shows one still.
// Debug (local review only): ?hero-debug exposes window.__hero { seek(t), play(), info(), perf() };
// ?hero-t=6.5 freezes the loop at that time.
import { target, clear, applyMask } from './pixel.js';
import { renderScene, KW, KH, DURATION, FPS, STILL_T } from './scenes.js';

const CAP = 80;        // highest channel value (0..255) left under the name and the text below it
const FALL = 6;        // pixels of dithered fall-off around the dimmed boxes
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export function mountHero(canvas) {
  const hero = canvas.closest('.hero');
  if (!hero) return () => {};
  const g = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const fixedT = params.has('hero-t') ? Number(params.get('hero-t')) : null;
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let L = null, img = null, buf = null, mIdx = null, mK = null;
  let raf = 0, visible = true, tNow = 0, t0 = performance.now(), lastF = -1, debugHold = false;
  const perf = { n: 0, ms: 0, max: 0 };

  const box = (el, hr) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { x0: r.left - hr.left, y0: r.top - hr.top, x1: r.right - hr.left, y1: r.bottom - hr.top } : null;
  };
  const textBox = (el, hr) => {   // the box of the text itself, not of its full-width block
    if (!el) return null;
    const rg = document.createRange(); rg.selectNodeContents(el);
    let b = null;
    for (const r of rg.getClientRects()) {
      if (!r.width) continue;
      const q = { x0: r.left - hr.left, y0: r.top - hr.top, x1: r.right - hr.left, y1: r.bottom - hr.top };
      b = b ? { x0: Math.min(b.x0, q.x0), y0: Math.min(b.y0, q.y0), x1: Math.max(b.x1, q.x1), y1: Math.max(b.y1, q.y1) } : q;
    }
    return b;
  };
  const union = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

  function layout() {
    const hr = hero.getBoundingClientRect();
    const HW = hr.width, HH = hr.height, dpr = window.devicePixelRatio || 1;
    if (!HW || !HH) return;
    const cs = getComputedStyle(hero), pad = parseFloat(cs.paddingLeft) || 16;
    const name = box(hero.querySelector('.name-btn'), hr) || box(hero.querySelector('.name'), hr);
    const text = union(name, textBox(hero.querySelector('.affil'), hr));
    const entries = box(hero.querySelector('.entries'), hr);
    const nav = box(document.querySelector('.bar nav'), hr);
    const top = Math.max(nav ? nav.y1 : 0, 0) + 8, gap = 12;
    const bottom = entries ? entries.y0 - gap : HH - gap;
    // zone A: right of the name, above the entries (the small affiliation line may run under its ground strip);
    // zone B: above the text, full width
    const zones = [];
    if (text) {
      zones.push({ k: 'A', x0: (name || text).x1 + gap, x1: HW - pad, y0: top, y1: bottom, tol: 1.2 });   // may tuck 1/6 under the text (capped there)
      zones.push({ k: 'B', x0: pad, x1: HW - pad, y0: top, y1: text.y0 - gap, tol: 1 });
    } else zones.push({ k: 'B', x0: pad, x1: HW - pad, y0: top, y1: bottom, tol: 1 });
    let best = null;
    for (const z of zones) {
      const zw = z.x1 - z.x0, zh = z.y1 - z.y0;
      if (zw <= 0 || zh <= 0) continue;
      const s = Math.floor(dpr * Math.min(zw * z.tol / KW, zh / KH));   // device px per art px
      if (!best || s > best.s || (s === best.s && (z.k === 'A') === (HW > HH))) best = { ...z, s };
    }
    const s = Math.max(1, Math.min(best ? best.s : 1, Math.round(8 * dpr)));
    const W = Math.ceil(HW * dpr / s), H = Math.ceil(HH * dpr / s);
    const toPx = (v) => v * dpr / s;
    let kx, ky;
    if (best && best.k === 'A') { kx = Math.floor(toPx(best.x1)) - KW; ky = Math.floor(toPx(best.y1)) - KH; }
    else if (best) { kx = Math.round(toPx((best.x0 + best.x1) / 2) - KW / 2); ky = Math.floor(toPx(best.y1)) - KH; }
    else { kx = Math.round((W - KW) / 2); ky = Math.round((H - KH) / 2); }
    ky = Math.max(ky, Math.ceil(toPx(top)) - 4);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    canvas.style.width = (W * s / dpr) + 'px';
    canvas.style.height = (H * s / dpr) + 'px';
    img = g.createImageData(W, H);
    buf = new Uint32Array(img.data.buffer);
    // dim mask: name + affiliation, the entries strip, the nav links
    const dimBoxes = [text, entries, nav].filter(Boolean).map((b) => [toPx(b.x0) - 1, toPx(b.y0) - 1, toPx(b.x1) + 1, toPx(b.y1) + 1]);
    const idx = [], ks = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let d = Infinity;
      for (const [a, b, c, e] of dimBoxes) {
        const dx = x + 0.5 < a ? a - x - 0.5 : x + 0.5 > c ? x + 0.5 - c : 0, dy = y + 0.5 < b ? b - y - 0.5 : y + 0.5 > e ? y + 0.5 - e : 0;
        d = Math.min(d, Math.max(dx, dy));
      }
      if (d >= FALL) continue;
      const u = d / FALL;   // 0 inside .. 1 at the edge of the fall-off
      const k = u > BAYER[((y & 3) << 2) | (x & 3)] ? Math.round(CAP + (255 - CAP) * u) : CAP;
      idx.push(y * W + x); ks.push(k);
    }
    mIdx = Uint32Array.from(idx); mK = Uint8Array.from(ks);
    L = { W, H, kx, ky, s, dpr, zone: best ? best.k : '-', css: { W: HW, H: HH } };
    draw(currentT());
  }

  function draw(t) {
    if (!L) return;
    const a = performance.now();
    target(buf, L.W, L.H); clear();
    renderScene(t, L);
    applyMask(buf, mIdx, mK);
    g.putImageData(img, 0, 0);
    const ms = performance.now() - a;
    perf.n++; perf.ms += ms; perf.max = Math.max(perf.max, ms);
  }
  const still = () => fixedT !== null || rm.matches || debugHold;
  const currentT = () => (fixedT !== null ? fixedT : rm.matches ? STILL_T : tNow);
  function frame(now) {
    raf = 0;
    if (still() || !visible || document.hidden) return;
    tNow = ((now - t0) / 1000) % DURATION;
    const f = Math.floor(tNow * FPS);
    if (f !== lastF) { lastF = f; draw(f / FPS); }
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (raf || still() || !visible || document.hidden) return;
    t0 = performance.now() - tNow * 1000;
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  const ro = new ResizeObserver(() => layout());
  ro.observe(hero);
  const nb = hero.querySelector('.name-btn'); if (nb) ro.observe(nb);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : stop(); }, { threshold: 0 });
  io.observe(hero);
  const onVis = () => (document.hidden ? stop() : play());
  document.addEventListener('visibilitychange', onVis);
  const onRM = () => { stop(); draw(currentT()); play(); };
  rm.addEventListener('change', onRM);
  const onDpr = () => layout();
  window.addEventListener('resize', onDpr);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());
  layout();
  play();

  if (params.has('hero-debug')) {
    window.__hero = {
      seek(t) { debugHold = true; stop(); tNow = t; draw(t); },
      play() { debugHold = false; play(); },
      info() { return L && { W: L.W, H: L.H, kx: L.kx, ky: L.ky, s: L.s, dpr: L.dpr, zone: L.zone, masked: mIdx.length }; },
      perf() { const r = { frames: perf.n, avgMs: perf.n ? perf.ms / perf.n : 0, maxMs: perf.max }; perf.n = 0; perf.ms = 0; perf.max = 0; return r; },
    };
  }
  return () => {
    stop(); ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    rm.removeEventListener('change', onRM);
    window.removeEventListener('resize', onDpr);
  };
}
