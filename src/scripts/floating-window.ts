// Floating window opened from the hero name.
//
// Native <dialog> with showModal(): focus moves into the window, the rest of
// the page is inert, and Esc closes it. On close, focus returns to the name.
// While open, page scrolling (and Lenis) is stopped. On desktop (wide screen,
// fine pointer) the window can be dragged by its title bar; on phones it stays
// centred. The body plays a placeholder loop (the Hilbert-panel scene), loaded
// only when the window first opens.
import { setScrollLocked } from './motion';

const canDrag = () => window.matchMedia('(min-width: 48rem) and (pointer: fine)').matches;

export function initFloatingWindow(trigger: HTMLElement | null, dialog: HTMLDialogElement | null) {
  if (!trigger || !dialog || typeof dialog.showModal !== 'function') return;
  const bar = dialog.querySelector<HTMLElement>('[data-drag]');
  const canvas = dialog.querySelector<HTMLCanvasElement>('canvas');
  let stopScene: (() => void) | null = null;

  const open = async () => {
    // Re-centre each time it opens.
    dialog.style.left = ''; dialog.style.top = ''; dialog.removeAttribute('data-moved');
    dialog.showModal();
    setScrollLocked(true);
    if (canvas && !stopScene) {
      const { runScene, webglAvailable } = await import('../scenes/runner');
      if (!dialog.open || !webglAvailable()) return;
      const { buildBeads } = await import('../scenes/beads');
      stopScene = runScene({
        canvas, loopSeconds: 7,
        build: () => buildBeads({ path: 'hilbert', colorA: '#B9BFC8', colorB: '#F2C14E', nozzle: '#A3C8FF' }),
      });
    }
  };

  dialog.addEventListener('close', () => {
    stopScene?.(); stopScene = null;
    setScrollLocked(false);
    trigger.focus();
  });
  dialog.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  // A click on the backdrop (outside the window box) closes it.
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dialog.close();
  });
  trigger.addEventListener('click', open);

  // Drag by the title bar (desktop only).
  if (bar) {
    let dx = 0, dy = 0, dragging = false;
    bar.addEventListener('pointerdown', (e) => {
      if (!canDrag() || (e.target as HTMLElement).closest('button')) return;
      const r = dialog.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top; dragging = true;
      bar.setPointerCapture(e.pointerId);
      dialog.setAttribute('data-moved', '');
      dialog.style.left = `${r.left}px`; dialog.style.top = `${r.top}px`;
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = dialog.getBoundingClientRect();
      const x = Math.min(window.innerWidth - r.width, Math.max(0, e.clientX - dx));
      const y = Math.min(window.innerHeight - 40, Math.max(0, e.clientY - dy));
      dialog.style.left = `${x}px`; dialog.style.top = `${y}px`;
    });
    const end = () => { dragging = false; };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }
}
