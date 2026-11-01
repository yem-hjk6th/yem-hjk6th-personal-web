// Hero: the pixel-art story next to the name, a 12 s silent loop (public/media/hero/).
// Plays only while on screen; with prefers-reduced-motion it keeps the poster, a still of scene 3.
export function mountHero(video: HTMLVideoElement | null) {
  if (!video) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) video.play().catch(() => {}); else video.pause();
  });
  io.observe(video);
}
