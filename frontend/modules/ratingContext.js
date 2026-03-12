// frontend/modules/ratingContext.js
// PendingStore är enda sanningskällan.
// ratingContext visar bara overlay och reagerar robust även om pending kommer lite sent.

import auth from './auth.js';
import { t } from './landing/language.js';
import { captureFromUrl, captureFromExtensionBridge, getPending, clearPending } from './pendingStore.js';

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

function isRatePage() {
  const path = (window.location.pathname || '').toLowerCase();
  return path.endsWith('/rate.html') || path.includes('/rate.html');
}

function hasIncomingQuery() {
  try {
    const qs = new URLSearchParams(window.location.search || '');
    return !!(qs.get('source') || qs.get('pageUrl') || qs.get('proofRef') || qs.get('pr'));
  } catch {
    return false;
  }
}

function getCurrentUser() {
  try {
    return auth.getUser?.() || null;
  } catch {
    return null;
  }
}

function isLoggedIn() {
  const u = getCurrentUser();
  return !!(u?.email || u?.subjectRef || u?.id);
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(s) {
  return String(s || '').replaceAll('"', '%22');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeOverlay() {
  try {
    document.getElementById('pr-pending-overlay')?.remove();
  } catch {}
}

function scrollToBestTarget() {
  const tryScroll = (attempt = 0) => {
    const loginTarget =
      document.getElementById('login-card') ||
      document.getElementById('rating-login-card') ||
      document.getElementById('rating-login-form');

    const formTarget =
      document.getElementById('locked-rating-card') ||
      document.getElementById('verified-deals-card') ||
      document.getElementById('rate-context-card') ||
      document.getElementById('rating-form') ||
      document.getElementById('rating-card');

    if (!isLoggedIn() && loginTarget) {
      loginTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (formTarget) {
      formTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (attempt < 10) {
      setTimeout(() => tryScroll(attempt + 1), 180);
    }
  };

  tryScroll(0);
}

function createOverlayIfNeeded(deal) {
  try {
    if (!isRatePage()) return;
    if (!deal) return;
    if (document.getElementById('pr-pending-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pr-pending-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,.45);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 90px 16px 16px;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width: min(820px, 100%);
      background: rgba(255,255,255,.98);
      border: 1px solid rgba(15,15,18,.10);
      border-radius: 18px;
      box-shadow: 0 30px 90px rgba(0,0,0,.20);
      padding: 16px;
    `;

    const prettySource = deal.source || t('rate_overlay_unknown_platform', 'Okänd plattform');

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="font-weight:850; letter-spacing:-.01em; font-size:16px;">
          ${escapeHtml(t('rate_overlay_title', 'Du har en affär att betygsätta'))}
        </div>
        <button id="pr-pending-close" type="button"
          style="border:1px solid rgba(0,0,0,.12); background:#fff; border-radius:999px; padding:8px 12px; font-weight:750; cursor:pointer;">
          ${escapeHtml(t('rate_overlay_close', 'Inte nu'))}
        </button>
      </div>

      <div style="margin-top:10px; font-size:13px; opacity:.75; line-height:1.5;">
        <div><b>${escapeHtml(t('rate_overlay_platform_label', 'Plattform:'))}</b> ${escapeHtml(prettySource)}</div>
        ${deal.proofRef ? `<div><b>${escapeHtml(t('rate_overlay_reference_label', 'Referens:'))}</b> ${escapeHtml(deal.proofRef)}</div>` : ''}
        ${deal.pageUrl ? `<div style="margin-top:6px;"><a href="${escapeAttr(deal.pageUrl)}" target="_blank" rel="noreferrer"
           style="color:inherit; text-decoration:underline;">${escapeHtml(t('rate_overlay_open_deal', 'Öppna affären'))}</a></div>` : ''}
        <div style="margin-top:8px;">
          ${escapeHtml(t('rate_overlay_body', 'För att fortsätta behöver du antingen skriva omdöme eller rensa affärsdata.'))}
        </div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
        <button id="pr-pending-go" type="button"
          style="border:1px solid rgba(0,0,0,.12); background: linear-gradient(135deg, #0b1633, #0f2a66);
                 color: rgba(255,255,255,.96); border-radius:999px; padding:10px 14px; font-weight:850; cursor:pointer;">
          ${escapeHtml(t('rate_overlay_go', 'Skriv omdöme →'))}
        </button>

        <button id="pr-pending-clear" type="button"
          style="border:1px solid rgba(0,0,0,.12); background:#fff; border-radius:999px; padding:10px 14px; font-weight:800; cursor:pointer;">
          ${escapeHtml(t('rate_overlay_clear', 'Rensa affärsdata'))}
        </button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    card.querySelector('#pr-pending-close')?.addEventListener('click', () => {
      removeOverlay();
    });

    card.querySelector('#pr-pending-clear')?.addEventListener('click', () => {
      clearAllPendingEverywhere();
      removeOverlay();
    });

    card.querySelector('#pr-pending-go')?.addEventListener('click', () => {
      removeOverlay();
      scrollToBestTarget();
    });
  } catch {}
}

async function ensurePendingForOverlay({
  attempts = 8,
  delayMs = 350,
} = {}) {
  for (let i = 0; i < attempts; i += 1) {
    captureFromUrl();

    let pending = getPending();
    if (pending) return pending;

    pending = await captureFromExtensionBridge(1200);
    if (pending) return pending;

    pending = getPending();
    if (pending) return pending;

    if (i < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return getPending();
}

async function renderOverlayFromCanonicalPending() {
  removeOverlay();

  if (!isRatePage()) return;

  const pending = await ensurePendingForOverlay({
    attempts: 6,
    delayMs: 300,
  });

  if (!pending) return;

  setTimeout(() => {
    createOverlayIfNeeded(getPending() || pending);
  }, 120);
}

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
  try {
    if (!isRatePage() && !hasIncomingQuery() && !getPending()) return;

    if (hasIncomingQuery()) {
      captureFromUrl();
    }

    void renderOverlayFromCanonicalPending();

    window.addEventListener('pr:pending-updated', () => {
      void renderOverlayFromCanonicalPending();
    });

    window.addEventListener('pr:pending-cleared', () => {
      removeOverlay();
    });

    window.addEventListener('storage', () => {
      void renderOverlayFromCanonicalPending();
    });

    if (isRatePage()) {
      setTimeout(() => {
        if (!document.getElementById('pr-pending-overlay') && getPending()) {
          void renderOverlayFromCanonicalPending();
        }
      }, 1000);

      setTimeout(() => {
        if (!document.getElementById('pr-pending-overlay')) {
          void renderOverlayFromCanonicalPending();
        }
      }, 2200);
    }
  } catch (e) {
    console.warn('[PeerRate] ratingContext guards failed (ignored):', e);
  }
}