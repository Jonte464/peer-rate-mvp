// frontend/modules/ratingContext.js
// Förenklad version:
// - ingen overlay
// - ingen extra "open pending rating"-styrning
// - pendingStore.js är enda sanningskällan
// - denna modul används bara för städning och kompatibilitet

import { clearPending } from './pendingStore.js';

const LEGACY_CONTEXT_KEYS = [
  'peerRateRatingContext',
  'peerRateRateContext',
  'peerRatePrefill',
  'ratingContext',
  'rateContext',
  'peerRateDraftRating',
  'peerRatePendingRating',
  'peerRatePendingDeal',
  'peerrate_pending_rating_v2',
];

export function clearAllPendingEverywhere() {
  try {
    clearPending();
  } catch {}

  try {
    for (const k of LEGACY_CONTEXT_KEYS) {
      try { localStorage.removeItem(k); } catch {}
      try { sessionStorage.removeItem(k); } catch {}
    }
  } catch {}

  try {
    const prefix = 'peerRatePendingDeal:';
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {}

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('source');
    url.searchParams.delete('pageUrl');
    url.searchParams.delete('proofRef');
    url.searchParams.delete('pr');
    window.history.replaceState({}, '', url.toString());
  } catch {}
}

export function initRatingContextGuards() {
  // Medvetet tom.
  // Vi behåller exporten så att main.js och annan kod inte går sönder,
  // men vi låter inte längre denna modul styra själva rating-flödet.
}