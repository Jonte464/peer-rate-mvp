// frontend/modules/main.js
// Huvudfil som startar rätt saker beroende på vilken sida man är på.

import auth from './auth.js';

// ✅ initRatingLogin ska importeras härifrån:
import { initRatingLogin } from './ratingForm.js';

// Profile-funktioner (utan initRatingLogin här)
import { updateUserBadge, updateAvatars, initProfilePage } from './profile.js';

import { adminLoginForm, adminLogoutBtn } from './admin.js';
import customerForm from './customer.js';

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
 * Läs ?source=...&pageUrl=... och förifyll rate-formulär där det går.
 * (Funkar både på rate.html och index om formuläret finns.)
 */
function applyRatingContextFromQuery() {
  const params = new URLSearchParams(window.location.search || '');
  const sourceRaw = (params.get('source') || '').trim();
  const pageUrlRaw = (params.get('pageUrl') || '').trim();

  if (!sourceRaw && !pageUrlRaw) return;

  const card = document.getElementById('rate-context-card');
  const sourceEl = document.getElementById('rate-context-source');
  const linkEl = document.getElementById('rate-context-link');

  const prettySourceMap = {
    tradera: 'Tradera',
    blocket: 'Blocket',
    airbnb: 'Airbnb',
    husknuten: 'Husknuten',
    tiptap: 'Tiptap'
  };

  const prettySource = prettySourceMap[sourceRaw.toLowerCase()] || (sourceRaw ? sourceRaw : '–');

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

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  const user = auth.getUser?.() || null;

  updateUserBadge(user);
  updateAvatars(user);
  updateTopUserPill(user);

  initLandingMenu();

  initUserDropdown({
    auth,
    getUser: () => auth.getUser?.() || null,
    onAfterLogout: () => {
      const u2 = auth.getUser?.() || null;
      updateTopUserPill(u2);
      updateUserBadge(u2);
      updateAvatars(u2);
    }
  });

  if (customerForm) console.log('Customer form loaded');
  if (adminLoginForm && adminLogoutBtn) console.log('Admin functionality loaded');

  const path = window.location.pathname || '';

  if (path.includes('/min-profil') || path.includes('profile.html') || path.includes('/profile')) {
    initProfilePage();
  }

  const isRatingPage =
    path.includes('/lamna-betyg') ||
    path.includes('/rate.html') ||
    document.getElementById('rating-card');

  if (isRatingPage) {
    initRatingLogin();            // ✅ nu kommer den från ratingForm.js
    updateRatingLoginHint(user);
    applyRatingContextFromQuery();
  }

  const isIndex =
    path === '/' ||
    path.endsWith('/index.html') ||
    document.getElementById('slot-hero') ||
    document.querySelector('.hero');

  if (isIndex) {
    initLanding();
  }

  window.addEventListener('storage', () => {
    updateTopUserPill(auth.getUser?.() || null);
  });
  setInterval(() => updateTopUserPill(auth.getUser?.() || null), 1500);
});
