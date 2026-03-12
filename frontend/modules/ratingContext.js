// frontend/modules/ratingContext.js
// Enkel kompatibilitetsmodul.
// Ingen overlay, ingen styrning av ratingflödet.
// Används bara för att kunna rensa gammal pending-data på ett ställe.

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
}