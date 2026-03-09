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
import { initRatingContextGuards } from './ratingContext.js';

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
 */
function updateRateLoginCardVisibility(user) {
  const loginCard = document.getElementById('login-card');
  if (!loginCard) return;
  loginCard.style.display = user ? 'none' : 'block';
}

/**
 * Läs ?source=...&pageUrl=... och förifyll rate-formulär där det går.
 */
function applyRatingContextFromQuery() {
  const params = new URLSearchParams(window.location.search || '');
  const sourceRaw = (params.get('source') || '').trim();
  const pageUrlRaw = (params.get('pageUrl') || '').trim();

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
 * ✅ Fixar hooks som menyer ofta kräver:
 * - Om header/top-row finns men saknar id="top-row", sätt det.
 * - Om top-actions saknar id="top-actions", sätt det (eller skapa).
 */
function ensureMenuHooks() {
  if (!document.getElementById('top-row')) {
    const header = document.querySelector('header.top-row') || document.querySelector('.top-row');
    if (header && !header.id) header.id = 'top-row';
  }

  const topRow = document.getElementById('top-row');
  if (!topRow) return;

  let topActions = document.getElementById('top-actions');
  if (!topActions) {
    const existing = topRow.querySelector('.top-actions');
    if (existing) {
      existing.id = 'top-actions';
      topActions = existing;
    }
  }

  if (!topActions) {
    const inner = topRow.querySelector('.top-row-inner') || topRow;
    const div = document.createElement('div');
    div.id = 'top-actions';
    div.className = 'top-actions';
    inner.appendChild(div);
  }
}

/**
 * ✅ Fallback-hamburger (ENDAST för customer-sidan)
 * Vi vill inte skapa dubbla menyer på andra sidor där landing/menu.js redan funkar.
 */
function ensureHamburgerFallbackOnlyOnCustomer() {
  const path = (window.location.pathname || '').toLowerCase();
  const dataPage = (document.body?.dataset?.page || '').toLowerCase();
  const isCustomer =
    dataPage === 'customer' || path.endsWith('/customer.html') || path.includes('/customer');

  if (!isCustomer) return;

  const topRow = document.getElementById('top-row');
  if (!topRow) return;

  const topActions = document.getElementById('top-actions') || topRow.querySelector('.top-actions');
  if (!topActions) return;

  const alreadyHasMenuButton =
    !!document.getElementById('pr-menu-btn') ||
    !!topActions.querySelector('button[aria-label*="meny" i]') ||
    !!topActions.querySelector('button[title*="meny" i]') ||
    (!!topActions.querySelector('button, a') && topActions.textContent.includes('☰'));

  if (alreadyHasMenuButton) return;

  const btn = document.createElement('button');
  btn.id = 'pr-menu-btn';
  btn.type = 'button';
  btn.className = 'btn-pill soft-hover';
  btn.setAttribute('aria-label', 'Öppna meny');
  btn.textContent = '☰';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.minWidth = '44px';

  topActions.appendChild(btn);

  let overlay = document.getElementById('pr-menu-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pr-menu-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      opacity: 0; pointer-events: none; transition: opacity 160ms ease;
      z-index: 9998;
    `;
    document.body.appendChild(overlay);
  }

  let drawer = document.getElementById('pr-menu-drawer');
  if (!drawer) {
    drawer = document.createElement('nav');
    drawer.id = 'pr-menu-drawer';
    drawer.style.cssText = `
      position: fixed; top: 0; right: 0; height: 100vh; width: min(360px, 88vw);
      background: rgba(255,255,255,.98); border-left: 1px solid rgba(15,15,18,.10);
      transform: translateX(102%); transition: transform 200ms ease;
      z-index: 9999; padding: 16px;
      box-shadow: -20px 0 60px rgba(0,0,0,.12);
      display: flex; flex-direction: column; gap: 10px;
    `;

    drawer.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 6px 2px;">
        <div style="font-weight:800; letter-spacing:-.01em;">PeerRate</div>
        <button id="pr-menu-close" class="btn-pill soft-hover" type="button" aria-label="Stäng meny">✕</button>
      </div>

      <a href="/#top" class="btn-pill soft-hover" style="justify-content:flex-start; text-decoration:none;">Hem</a>
      <a href="/#sim" class="btn-pill soft-hover" style="justify-content:flex-start; text-decoration:none;">5P-modellen</a>
      <a href="/rate.html" class="btn-pill soft-hover" style="justify-content:flex-start; text-decoration:none;">Lämna betyg</a>
      <a href="/profile.html" class="btn-pill soft-hover" style="justify-content:flex-start; text-decoration:none;">Min profil</a>
      <a href="/customer.html" class="btn-pill soft-hover" style="justify-content:flex-start; text-decoration:none;">Registrera</a>

      <div style="margin-top:auto; font-size:12px; opacity:.65; padding: 10px 2px;">
        © PeerRate
      </div>
    `;
    document.body.appendChild(drawer);
  }

  const closeBtn = drawer.querySelector('#pr-menu-close');

  const open = () => {
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    drawer.style.transform = 'translateX(0)';
  };

  const close = () => {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    drawer.style.transform = 'translateX(102%)';
  };

  btn.addEventListener('click', () => {
    const isOpen = overlay.style.pointerEvents === 'auto';
    if (isOpen) close();
    else open();
  });

  overlay.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

function initApp() {
  console.log('DOM ready');
  initRatingContextGuards();

  ensureMenuHooks();

  const user = auth.getUser?.() || null;

  updateUserBadge(user);
  updateAvatars(user);
  updateTopUserPill(user);

  try {
    initLandingMenu();
  } catch (e) {
    console.warn('initLandingMenu failed (non-blocking)', e);
  }

  ensureHamburgerFallbackOnlyOnCustomer();

  try {
    initUserDropdown({
      auth,
      getUser: () => auth.getUser?.() || null,
      onAfterLogout: () => {
        const u2 = auth.getUser?.() || null;
        updateTopUserPill(u2);
        updateUserBadge(u2);
        updateAvatars(u2);
      },
    });
  } catch (e) {
    console.warn('initUserDropdown failed (non-blocking)', e);
  }

  if (adminLoginForm && adminLogoutBtn) console.log('Admin functionality loaded');

  const path = window.location.pathname || '';
  const dataPage = (document.body?.dataset?.page || '').toLowerCase();

  // --- Customer / registrering ---
  if (document.getElementById('customer-form')) {
    initCustomerForm();
  }

  // --- Profile ---
  const isProfilePage =
    path.includes('/min-profil') || path.includes('profile.html') || path.includes('/profile');
  if (isProfilePage) {
    initProfilePage();
  }

  // --- Rating (rate.html / rating-card) ---
  const isRatingPage =
    path.includes('/lamna-betyg') ||
    path.includes('/rate.html') ||
    !!document.getElementById('rating-card');

  if (isRatingPage) {
    applyRatingContextFromQuery();

    initRatingPlatform();
    initPlatformPicker();
    initRatingLogin();

    updateRateLoginCardVisibility(user);
    updateRatingLoginHint(user);
  }

  // --- Landing (index) ---
  const isIndex =
    dataPage === 'index' ||
    path === '/' ||
    path.endsWith('/index.html') ||
    !!document.getElementById('slot-hero');

  if (isIndex) {
    initLanding();
  }

  // Keep top-user pill updated if other tabs log in/out
  window.addEventListener('storage', () => {
    updateTopUserPill(auth.getUser?.() || null);
  });

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
  try {
    initRatingContextGuards();
    window.__peerRateRatingContextLoaded = true;
  } catch (e) {
    console.warn('[PeerRate] ratingContext init failed', e);
  }
} else {
  boot();
}