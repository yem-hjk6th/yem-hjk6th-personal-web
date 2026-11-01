// Hero: the pixel-art story next to the name. Runs after first paint.
import { mountPixelStory } from '../scenes/pixel-story';

export function mountHero(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const go = () => mountPixelStory(canvas);
  const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
  if (document.readyState === 'complete') idle(go); else window.addEventListener('load', () => idle(go), { once: true });
}
