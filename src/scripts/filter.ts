import { scrollToEl } from './motion';

// Audience filter. Buttons with [data-audience] toggle which project items
// ([data-audiences="a b"]) are shown. Without JS every project stays visible.
// The choice is kept in the URL (?for=robotics-cv) so a filtered view can be linked.

export function initFilter(root: ParentNode = document) {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-audience]'));
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-audiences]'));
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  const known = new Set(buttons.map((b) => b.dataset.audience));

  const apply = (id: string, push: boolean) => {
    if (!known.has(id)) id = 'all';
    let shown = 0;
    items.forEach((el) => {
      const on = id === 'all' || (el.dataset.audiences ?? '').split(' ').includes(id);
      el.hidden = !on;
      if (on) shown++;
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.audience === id)));
    document.documentElement.dataset.audience = id;
    if (status) {
      const label = buttons.find((b) => b.dataset.audience === id)?.dataset.label;
      status.textContent = id === 'all' ? `Showing all ${shown} projects` : `Showing ${shown} projects for ${label}`;
    }
    if (push) {
      const url = new URL(location.href);
      if (id === 'all') url.searchParams.delete('for'); else url.searchParams.set('for', id);
      history.replaceState(null, '', url);
    }
    document.dispatchEvent(new CustomEvent('audiencechange', { detail: id }));
  };

  buttons.forEach((b) => b.addEventListener('click', () => {
    apply(b.dataset.audience!, true);
    const target = b.dataset.scroll ? document.querySelector<HTMLElement>(b.dataset.scroll) : null;
    if (target) scrollToEl(target);
  }));
  apply(new URLSearchParams(location.search).get('for') ?? 'all', false);
}
