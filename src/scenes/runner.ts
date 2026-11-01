// Shared three.js plumbing for the hero scenes: renderer, resize, pause when
// off-screen, and a single still frame when the reader prefers reduced motion.
import * as THREE from 'three';

export interface SceneParts {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** progress 0..1 (build-up), t seconds since start */
  update(progress: number, t: number): void;
  dispose?(): void;
}

export interface RunOptions {
  canvas: HTMLCanvasElement;
  build(): SceneParts;
  /** Reads current scroll-driven progress (0..1). Unused when loopSeconds is set. */
  scrollProgress?(): number;
  /** Loop the build forever over this many seconds instead of intro + scroll. */
  loopSeconds?: number;
  /** Seconds for the intro build-up that plays without scrolling. */
  introSeconds?: number;
  /** Fraction of the build the intro reaches before scroll takes over. */
  introReach?: number;
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function runScene(opts: RunOptions) {
  const { canvas } = opts;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const parts = opts.build();
  const introSeconds = opts.introSeconds ?? 4;
  const introReach = opts.introReach ?? 0.6;

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    parts.camera.aspect = w / h;
    parts.camera.updateProjectionMatrix();
  };
  resize();

  const frame = (t: number) => {
    const intro = Math.min(1, t / introSeconds);
    const eased = 1 - Math.pow(1 - intro, 3);
    const p = reduced ? 1
      : opts.loopSeconds ? (t % opts.loopSeconds) / opts.loopSeconds
      : Math.max(eased * introReach, opts.scrollProgress?.() ?? 0);
    parts.update(Math.min(1, p), reduced ? 0 : t);
    renderer.render(parts.scene, parts.camera);
  };

  // Animate continuously only during the intro; afterwards draw a frame only
  // when the scroll position changes the build (saves battery and main thread).
  let raf = 0, visible = true, last = -1;
  const start = performance.now();
  const loop = (now: number) => {
    raf = 0;
    const t = (now - start) / 1000;
    if (opts.loopSeconds) {
      frame(t);
    } else {
      const inIntro = t < introSeconds;
      const key = Math.round((opts.scrollProgress?.() ?? 0) * 2000);
      if (inIntro || key !== last) {
        frame(Math.min(t, introSeconds));
        last = inIntro ? -1 : key;
      }
    }
    if (visible && !reduced) raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf && !reduced) raf = requestAnimationFrame(loop);
  });
  io.observe(canvas);
  const ro = new ResizeObserver(() => { resize(); last = -1; if (reduced) frame(0); });
  ro.observe(canvas);
  canvas.dataset.ready = 'true';
  if (reduced) frame(0); else raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
    parts.dispose?.(); renderer.dispose();
  };
}
