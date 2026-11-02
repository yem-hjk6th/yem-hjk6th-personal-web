// Work index layout: list (default) or grid. Buttons with [data-view] set
// [data-layout] on the section; the choice is remembered in this browser only.
// Without JS the toggle stays hidden and the list shows.
const KEY = 'yem-work-layout';

export function initViewToggle(section: HTMLElement | null) {
  if (!section) return;
  const group = section.querySelector<HTMLElement>('[data-view-toggle]');
  const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>('button[data-view]'));
  if (!group || !buttons.length) return;

  const apply = (layout: string) => {
    if (layout !== 'grid') layout = 'list';
    section.dataset.layout = layout;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === layout)));
  };
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked: use the default */ }
  apply(saved ?? 'list');
  group.hidden = false;
  buttons.forEach((b) => b.addEventListener('click', () => {
    apply(b.dataset.view!);
    try { localStorage.setItem(KEY, b.dataset.view!); } catch { /* not remembered */ }
  }));
}
