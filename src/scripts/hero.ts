// UNUSED since W2 (2026-11-02): the hero video now plays through components/Video.astro. Kept because file deletion is left to Ye.
// Plays only while on screen; with prefers-reduced-motion it keeps the poster, a still of scene 3.
export function mountHero(video: HTMLVideoElement | null) {
  if (!video) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) video.play().catch(() => {}); else video.pause();
  });
  io.observe(video);
}
