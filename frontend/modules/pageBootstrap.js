// frontend/modules/pageBootstrap.js
import { initLandingLanguage } from '/modules/landing/language.js';
import { initTopRow } from '/modules/topRow.js';

async function injectPartial(slotId, url) {
  const slot = document.getElementById(slotId);
  if (!slot) return false;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load partial ${url} (${res.status})`);
  slot.innerHTML = await res.text();
  return true;
}

(async function boot() {
  // 1) Inject global header (top-row) if the page has a slot
  try {
    await injectPartial('slot-top-row', '/partials/index/top-row.html');
  } catch (e) {
    console.warn('Header inject failed:', e);
  }

  // 2) Init top row functionality (menu + user menu)
  try {
    initTopRow();
  } catch (e) {
    console.warn('initTopRow failed:', e);
  }

  // 3) Init language (needs langBtn/langMenu present → after header injection)
  try {
    initLandingLanguage();
  } catch (e) {
    console.warn('initLandingLanguage failed:', e);
  }

  // 4) Load main.js AFTER header exists (so logoutBtn etc can bind)
  try {
    await import('/modules/main.js');
  } catch (e) {
    console.error('Could not load main.js', e);
  }
})();