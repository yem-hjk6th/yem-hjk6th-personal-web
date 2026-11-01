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
  /** Reads current scroll-driven progress (0..1). */
  scrollProgress(): number;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const p = reduced ? 1 : Math.max(eased * introReach, opts.scrollProgress());
    parts.update(Math.min(1, p), reduced ? 0 : t);
    renderer.render(parts.scene, parts.camera);
  };

  let raf = 0, visible = true, start = performance.now();
  const loop = (now: number) => {
    raf = 0;
    frame((now - start) / 1000);
    if (visible && !reduced) raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf && !reduced) raf = requestAnimationFrame(loop);
  });
  io.observe(canvas);
  const ro = new ResizeObserver(() => { resize(); if (reduced) frame(0); });
  ro.observe(canvas);
  canvas.dataset.ready = 'true';
  if (reduced) frame(0); else raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
    parts.dispose?.(); renderer.dispose();
  };
}
