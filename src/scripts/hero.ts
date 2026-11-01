// Loads three.js only after the page has painted, then mounts the hero scene.
// If WebGL is missing the CSS placeholder behind the canvas stays visible.
import { scrollProgress } from './motion';

export function mountHero(canvas: HTMLCanvasElement | null, path: 'column' | 'hilbert', colors: { a: string; b: string; c: string }, opts: {
  trigger?: Element | null; start?: string; end?: string; introReach?: number;
} = {}) {
  if (!canvas) return;
  const go = async () => {
    const { runScene, webglAvailable } = await import('../scenes/runner');
    if (!webglAvailable()) return;
    const progress = scrollProgress(opts.trigger ?? canvas, opts.start, opts.end);
    const { buildBeads } = await import('../scenes/beads');
    runScene({ canvas, scrollProgress: progress, introReach: opts.introReach ?? 0.6, build: () =>
      buildBeads({ path, colorA: colors.a, colorB: colors.b, nozzle: colors.c }) });
  };
  const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
  if (document.readyState === 'complete') idle(go); else window.addEventListener('load', () => idle(go), { once: true });
}
