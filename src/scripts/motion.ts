// Lenis smooth scroll + GSAP ScrollTrigger, both off when the reader prefers reduced motion.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;
const tick = (time: number) => lenis?.raf(time * 1000);

// Smooth scrolling lives on the homepage only. The client router keeps this
// module alive across pages, so it is torn down before each page swap and
// created again when the homepage loads.
document.addEventListener('astro:before-swap', () => {
  if (!lenis) return;
  gsap.ticker.remove(tick);
  lenis.destroy();
  lenis = null;
});

export function initMotion() {
  if (prefersReduced() || lenis) return { gsap, ScrollTrigger, lenis };
  lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  // In-page anchor links go through Lenis so they glide instead of jump.
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!;
      const el = id.length > 1 ? document.querySelector<HTMLElement>(id) : null;
      if (!el) return;
      e.preventDefault();
      lenis!.scrollTo(el, { offset: -16 });
      history.replaceState(history.state, '', id);
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }),
  );
  return { gsap, ScrollTrigger, lenis };
}

export function scrollToEl(el: HTMLElement) {
  if (lenis) lenis.scrollTo(el, { offset: -16 });
  else el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth' });
}

/** Stop or resume smooth scrolling (used while a modal window is open). */
export function setScrollLocked(locked: boolean) {
  document.documentElement.classList.toggle('scroll-locked', locked);
  if (lenis) locked ? lenis.stop() : lenis.start();
}
