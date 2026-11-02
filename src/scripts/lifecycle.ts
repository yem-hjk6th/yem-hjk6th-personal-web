// Page lifecycle under Astro's client router (<ClientRouter /> in Base.astro):
// bundled scripts run once per session, so per-page setup hangs on
// astro:page-load, which fires on the first load and after every navigation.
export function onPageLoad(fn: () => void) {
  document.addEventListener('astro:page-load', fn);
}
