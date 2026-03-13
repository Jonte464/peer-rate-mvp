// frontend/js/rate-shell.js
// Egen bootstrap för rate.html.
// Viktigt: vi använder INTE pageBootstrap.js här,
// eftersom den laddar main.js som i sin tur initierar gamla legacy rate-moduler.

import { initLandingLanguage } from '/modules/landing/language.js';
import { initTopRow } from '/modules/topRow.js';

async function injectTopRow() {
  const slot = document.getElementById('slot-top-row');
  if (!slot) return;

  try {
    const res = await fetch('/partials/index/top-row.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Could not load top-row (${res.status})`);
    slot.innerHTML = await res.text();
  } catch (err) {
    console.warn('[PeerRate rate-shell] top-row inject failed:', err);
  }
}

async function boot() {
  await injectTopRow();

  try {
    initLandingLanguage();
  } catch (err) {
    console.warn('[PeerRate rate-shell] initLandingLanguage failed:', err);
  }

  try {
    initTopRow();
  } catch (err) {
    console.warn('[PeerRate rate-shell] initTopRow failed:', err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}