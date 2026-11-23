// Vector hero player (W21 candidates a/b/c): a full-bleed Canvas2D at device resolution (DPR capped at 2) behind
// the hero text. A scene module exports { DURATION, START, STILL_T, LABEL, layout(L), render(g, t, L) }.
// The player measures the text boxes, hands the scene a focus rect (right of the name when landscape, above the
// text when portrait), lays a soft black scrim under the name, affiliation, entries and nav (static DOM, no per-frame
// cost), pauses off screen and in hidden tabs, and shows one still under prefers-reduced-motion.
// Debug (local review only): ?hero-debug exposes window.__hero { seek(t), play(), info(), perf() }; ?hero-t=6.5 freezes.

const SCRIM = 0.72;   // scrim opacity under the text: art at most 28 % as bright there (name >= 8:1, affiliation >= 5:1)

export function mountVector(canvas, scene) {
  const hero = canvas.closest('.hero');
  const art = canvas.parentElement;
  if (!hero || !art) return () => {};
  const g = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const fixedT = params.has('hero-t') ? Number(params.get('hero-t')) : null;
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
  canvas.style.imageRendering = 'auto';
  // fade the drawing in on its first frame (opacity only: no layout shift); instant under reduced motion
  canvas.style.opacity = '0';
  if (!rm.matches) canvas.style.transition = 'opacity .7s ease-out';
  let shown = false;
  if (scene.LABEL) canvas.setAttribute('aria-label', scene.LABEL);
  const scrims = ['text', 'entries', 'nav'].map(() => {
    const d = document.createElement('div');
    d.className = 'hero-scrim';
    d.style.cssText = 'position:absolute;pointer-events:none;border-radius:24px;display:none;';
    art.appendChild(d);
    return d;
  });
  let L = null, raf = 0, visible = true, tNow = scene.START || 0, t0 = performance.now(), lastDraw = -1e9, debugHold = false;
  const perf = { n: 0, ms: 0, max: 0 };

  const box = (el, hr) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { x0: r.left - hr.left, y0: r.top - hr.top, x1: r.right - hr.left, y1: r.bottom - hr.top } : null;
  };
  const textBox = (el, hr) => {
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
    const HW = hr.width, HH = hr.height;
    if (!HW || !HH) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pad = parseFloat(getComputedStyle(hero).paddingLeft) || 16;
    const name = box(hero.querySelector('.name-btn'), hr) || box(hero.querySelector('.name'), hr);
    const text = union(name, textBox(hero.querySelector('.affil'), hr));
    const entries = box(hero.querySelector('.entries'), hr);
    const nav = box(document.querySelector('.bar nav'), hr);
    const top = Math.max(nav ? nav.y1 : 0, 0) + 12, gap = 16;
    const land = HW > HH * 1.1;
    const bottom = text ? (entries ? Math.min(entries.y0, HH) : HH) - gap : HH - gap;
    let focus;
    if (land && name && HW - name.x1 > HW * 0.3) focus = { x0: name.x1 + gap, y0: top, x1: HW - pad, y1: bottom };
    else focus = { x0: pad, y0: top, x1: HW - pad, y1: (text ? text.y0 : HH) - gap };
    const W = Math.round(HW * dpr), H = Math.round(HH * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    canvas.style.width = HW + 'px'; canvas.style.height = HH + 'px';
    const dev = (b) => b && { x0: b.x0 * dpr, y0: b.y0 * dpr, x1: b.x1 * dpr, y1: b.y1 * dpr };
    L = { W, H, dpr, land, cssW: HW, cssH: HH, focus: dev(focus), text: dev(text), name: dev(name), entries: dev(entries), nav: dev(nav), pad: pad * dpr };
    // scrims (css px): the core covers the box at SCRIM opacity, a wide soft edge fades out around it
    [text, entries, nav].forEach((b, i) => {
      const d = scrims[i];
      if (!b) { d.style.display = 'none'; return; }
      const m = i === 0 ? 10 : 6, s = i === 0 ? 18 : 10, bl = i === 0 ? 64 : 40;
      Object.assign(d.style, { display: 'block', left: (b.x0 - m) + 'px', top: (b.y0 - m) + 'px', width: (b.x1 - b.x0 + 2 * m) + 'px', height: (b.y1 - b.y0 + 2 * m) + 'px',
        background: `rgba(0,0,0,${SCRIM})`, boxShadow: `0 0 ${bl}px ${s}px rgba(0,0,0,${SCRIM})` });
    });
    if (scene.layout) scene.layout(L);
    draw(currentT());
  }

  function draw(t) {
    if (!L) return;
    const a = performance.now();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, L.W, L.H);
    scene.render(g, t, L);
    if (!shown) { shown = true; requestAnimationFrame(() => { canvas.style.opacity = '1'; }); }
    const ms = performance.now() - a;
    perf.n++; perf.ms += ms; perf.max = Math.max(perf.max, ms);
  }
  const still = () => fixedT !== null || rm.matches || debugHold;
  const currentT = () => (fixedT !== null ? fixedT : rm.matches ? scene.STILL_T : tNow);
  function frame(now) {
    raf = 0;
    if (still() || !visible || document.hidden) return;
    tNow = ((now - t0) / 1000) % scene.DURATION;
    if (now - lastDraw > 15) { lastDraw = now; draw(tNow); }   // at most ~60 draws a second, also on 120 Hz screens
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
  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());
  layout();
  play();

  if (params.has('hero-debug')) {
    window.__hero = {
      seek(t) { debugHold = true; stop(); tNow = t; draw(t); },
      play() { debugHold = false; play(); },
      info() { return L && { W: L.W, H: L.H, dpr: L.dpr, land: L.land, focus: L.focus, scene: scene.NAME }; },
      perf() { const r = { frames: perf.n, avgMs: perf.n ? perf.ms / perf.n : 0, maxMs: perf.max }; perf.n = 0; perf.ms = 0; perf.max = 0; return r; },
    };
  }
  return () => {
    stop(); ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    rm.removeEventListener('change', onRM);
    window.removeEventListener('resize', onResize);
    scrims.forEach((d) => d.remove());
    canvas.style.opacity = ''; canvas.style.transition = '';
  };
}
