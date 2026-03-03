// frontend/modules/main.js
// Huvudfil som startar rätt saker beroende på vilken sida man är på.

import auth from './auth.js';

// ✅ initRatingLogin + initPlatformPicker:
import { initRatingLogin, initPlatformPicker } from './ratingForm.js';

import { initRatingPlatform } from './ratingPlatform.js';

// Profile-funktioner
import { updateUserBadge, updateAvatars, initProfilePage } from './profile.js';

import { adminLoginForm, adminLogoutBtn } from './admin.js';
import { initCustomerForm } from './customer.js';

import { initLanding } from './landing/init.js';
import { updateTopUserPill, initUserDropdown } from './landing/topUser.js';
import { initLandingMenu } from './landing/menu.js';

/**
 * Döljer eller visar login-hint på sidan Lämna betyg.
 */
function updateRatingLoginHint(user) {
  const hint = document.getElementById('rating-login-hint');
  if (!hint) return;
  if (user) hint.classList.add('hidden');
  else hint.classList.remove('hidden');
}

/**
 * Döljer login-kortet när användaren redan är inloggad.
 * (På /rate.html vill du att "Steg 1: Logga in" ska försvinna när user finns.)
 */
function updateRateLoginCardVisibility(user) {
  const loginCard = document.getElementById('login-card');
  if (!loginCard) return;
  loginCard.style.display = user ? 'none' : 'block';
}

/**
 * Läs ?source=...&pageUrl=... och förifyll rate-formulär där det går.
 * Viktigt: Kontextkortet ska INTE visas om inga params finns.
 */
function applyRatingContextFromQuery() {
  const params = new URLSearchParams(window.location.search || '');
  const sourceRaw = (params.get('source') || '').trim();
  const pageUrlRaw = (params.get('pageUrl') || '').trim();

  // ✅ Default: göm kontextkortet om vi inte har query
  const card = document.getElementById('rate-context-card');
  if (card) card.style.display = 'none';

  if (!sourceRaw && !pageUrlRaw) return;

  const sourceEl = document.getElementById('rate-context-source');
  const linkEl = document.getElementById('rate-context-link');

  const prettySourceMap = {
    tradera: 'Tradera',
    blocket: 'Blocket',
    airbnb: 'Airbnb',
    husknuten: 'Husknuten',
    tiptap: 'Tiptap',
    ebay: 'eBay',
    hygglo: 'Hygglo',
    facebook_marketplace: 'Facebook Marketplace',
  };

  const prettySource =
    prettySourceMap[sourceRaw.toLowerCase()] || (sourceRaw ? sourceRaw : '–');

  let decodedPageUrl = '';
  try {
    decodedPageUrl = pageUrlRaw ? decodeURIComponent(pageUrlRaw) : '';
  } catch {
    decodedPageUrl = pageUrlRaw;
  }

  if (card) card.style.display = 'block';
  if (sourceEl) sourceEl.textContent = prettySource;

  if (linkEl) {
    if (decodedPageUrl) {
      linkEl.href = decodedPageUrl;
      linkEl.style.display = 'inline-block';
    } else {
      linkEl.href = '#';
      linkEl.style.display = 'none';
    }
  }

  const sourceSelect =
    document.querySelector('#rating-form select[name="source"]') ||
    document.getElementById('ratingSource');

  if (sourceSelect && prettySource && prettySource !== '–') {
    if (!sourceSelect.value) sourceSelect.value = prettySource;
  }

  const reportLinkInput = document.getElementById('reportLink');
  if (reportLinkInput && decodedPageUrl) {
    if (!reportLinkInput.value) reportLinkInput.value = decodedPageUrl;
  }

  const proofRefInput =
    document.querySelector('#rating-form input[name="proofRef"]') ||
    document.getElementById('proofRef');

  if (proofRefInput && !proofRefInput.value && decodedPageUrl) {
    const id = extractProofIdFromUrl(decodedPageUrl);
    if (id) proofRefInput.value = id;
  }
}

function extractProofIdFromUrl(url) {
  const u = (url || '').toLowerCase();

  let m = u.match(/\/item\/\d+\/(\d+)/);
  if (m && m[1]) return `TRADERA-${m[1]}`;

  m = u.match(/\/my\/order\/([a-z0-9]+)/);
  if (m && m[1]) return `TRADERA-ORDER-${m[1]}`;

  m = u.match(/(\d{6,})/);
  if (m && m[1]) return `REF-${m[1]}`;

  return '';
}

/**
 * ✅ Robust hook-fix för meny:
 * Vissa sidor (customer.html) hade .top-row men saknade id="top-row".
 * landing/menu.js brukar ofta leta efter #top-row eller specifika hooks.
 *
 * Den här funktionen:
 * - Sätter id="top-row" om header/top-row finns men saknar id
 * - Skapar #top-actions om den saknas (så menyn har någonstans att injicera knappar)
 */
function ensureMenuHooks() {
  // 1) top-row
  const existingTopRow = document.getElementById('top-row');
  if (!existingTopRow) {
    const header = document.querySelector('header.top-row') || document.querySelector('.top-row');
    if (header && !header.id) header.id = 'top-row';
  }

  const topRow = document.getElementById('top-row');
  if (!topRow) return;

  // 2) top-actions (valfritt, men bra att ha)
  let topActions = document.getElementById('top-actions');
  if (!topActions) {
    // försök hitta en befintlig container
    topActions = topRow.querySelector('.top-actions');
    if (topActions) {
      topActions.id = 'top-actions';
    } else {
      // skapa en om den inte finns
      topActions = document.createElement('div');
      topActions.id = 'top-actions';
      topActions.className = 'top-actions';
      // försök lägga den på rimligt ställe
      const shellInner =
        topRow.querySelector('.top-row-inner') ||
        topRow.querySelector('.shell') ||
        topRow;
      shellInner.appendChild(topActions);
    }
  }
}

/**
 * ✅ Kör en init-funktion men låt inte den krascha hela sidan.
 */
function safeInit(name, fn) {
  try {
    if (typeof fn === 'function') fn();
  } catch (e) {
    console.warn(`${name} failed (non-blocking)`, e);
  }
}

function initApp() {
  console.log('DOM ready');

  // ✅ Viktigt: fixa hooks innan vi initierar meny/dropdown
  ensureMenuHooks();

  const user = auth.getUser?.() || null;

  updateUserBadge(user);
  updateAvatars(user);
  updateTopUserPill(user);

  // ✅ Menyn var problemet på customer.html -> gör init robust
  safeInit('initLandingMenu', initLandingMenu);

  safeInit('initUserDropdown', () =>
    initUserDropdown({
      auth,
      getUser: () => auth.getUser?.() || null,
      onAfterLogout: () => {
        const u2 = auth.getUser?.() || null;
        updateTopUserPill(u2);
        updateUserBadge(u2);
        updateAvatars(u2);
      },
    })
  );

  if (adminLoginForm && adminLogoutBtn) console.log('Admin functionality loaded');

  const path = window.location.pathname || '';

  // --- Customer / registrering ---
  if (document.getElementById('customer-form')) {
    safeInit('initCustomerForm', initCustomerForm);
  }

  // --- Profile ---
  const isProfilePage =
    path.includes('/min-profil') || path.includes('profile.html') || path.includes('/profile');
  if (isProfilePage) {
    safeInit('initProfilePage', initProfilePage);
  }

  // --- Rating (rate.html / rating-card) ---
  const isRatingPage =
    path.includes('/lamna-betyg') ||
    path.includes('/rate.html') ||
    !!document.getElementById('rating-card');

  if (isRatingPage) {
    // ✅ Kontext från query ska appliceras här (den fanns men kallades inte)
    safeInit('applyRatingContextFromQuery', applyRatingContextFromQuery);

    // ✅ dropdown-flöde (öppna plattform)
    safeInit('initRatingPlatform', initRatingPlatform);

    // (om du fortfarande vill ha den andra också)
    safeInit('initPlatformPicker', initPlatformPicker);

    // befintligt
    safeInit('initRatingLogin', initRatingLogin);

    // ✅ Nytt: dölj login-kortet om inloggad
    updateRateLoginCardVisibility(user);

    // Hint kan vara kvar (döljs om inloggad)
    updateRatingLoginHint(user);
  }

  // --- Landing (index) ---
  const isIndex =
    path === '/' ||
    path.endsWith('/index.html') ||
    !!document.getElementById('slot-hero') ||
    !!document.querySelector('.hero');

  if (isIndex) {
    safeInit('initLanding', initLanding);
  }

  // Keep top-user pill updated if other tabs log in/out
  window.addEventListener('storage', () => {
    updateTopUserPill(auth.getUser?.() || null);
  });

  // small heartbeat (optional)
  setInterval(() => updateTopUserPill(auth.getUser?.() || null), 1500);
}

// Boot-safe: kör init även om DOMContentLoaded redan hänt
function boot() {
  try {
    initApp();
  } catch (e) {
    console.error('main.js boot failed', e);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}