// frontend/modules/main.js
// Huvudfil som startar rätt saker beroende på vilken sida man är på.

import auth from './auth.js';
import { updateUserBadge, updateAvatars, initProfilePage, initRatingLogin } from './profile.js';
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

  // 1) Visa källrutan om den finns
  const card = document.getElementById('rate-context-card');
  const sourceEl = document.getElementById('rate-context-source');
  const linkEl = document.getElementById('rate-context-link');

  // Mappa "tradera" -> "Tradera" osv (så det matchar dina <option>-värden)
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

  // 2) Förifyll dropdown "Varifrån kommer betyget?"
  const sourceSelect =
    document.querySelector('#rating-form select[name="source"]') ||
    document.getElementById('ratingSource');

  if (sourceSelect && prettySource && prettySource !== '–') {
    // sätt bara om användaren inte redan valt något
    if (!sourceSelect.value) sourceSelect.value = prettySource;
  }

  // 3) Förifyll "Motpart/annonslänk" i rapport-delen (om fältet finns)
  const reportLinkInput = document.getElementById('reportLink');
  if (reportLinkInput && decodedPageUrl) {
    if (!reportLinkInput.value) reportLinkInput.value = decodedPageUrl;
  }

  // 4) Försök förifylla "Verifierings-ID" om vi kan hitta ett ID i URL:en
  const proofRefInput =
    document.querySelector('#rating-form input[name="proofRef"]') ||
    document.getElementById('proofRef');

  if (proofRefInput && !proofRefInput.value && decodedPageUrl) {
    const id = extractProofIdFromUrl(decodedPageUrl);
    if (id) proofRefInput.value = id;
  }
}

/**
 * Försök hitta ett vettigt referens-ID ur en URL.
 * Ex: Tradera item-länk kan innehålla .../item/<cat>/<objectId>/...
 */
function extractProofIdFromUrl(url) {
  const u = (url || '').toLowerCase();

  // Tradera item: /item/341380/704309999/....
  let m = u.match(/\/item\/\d+\/(\d+)/);
  if (m && m[1]) return `TRADERA-${m[1]}`;

  // Tradera order: /my/order/<id>
  m = u.match(/\/my\/order\/([a-z0-9]+)/);
  if (m && m[1]) return `TRADERA-ORDER-${m[1]}`;

  // Fallback: plocka en längre sifferserie (t.ex. ordernr)
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

  // Initialize menu on all pages (not just landing)
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

  // Profile page
  if (
    path.includes('/min-profil') ||
    path.includes('profile.html') ||
    path.includes('/profile') ||
    path.includes('my-details') ||
    path.includes('my-details.html')
  ) {
    initProfilePage();
  }

  // Rating page (rate.html eller om rating-card finns)
  const isRatingPage =
    path.includes('/lamna-betyg') ||
    path.includes('/rate.html') ||
    document.getElementById('rating-card');

  if (isRatingPage) {
    initRatingLogin();
    updateRatingLoginHint(user);

    // ✅ NYTT: förifyll från query params (source/pageUrl)
    applyRatingContextFromQuery();
  }

  // Landing-interaktioner (kör bara på startsidan där blocken faktiskt finns)
  const isIndex =
    path === '/' ||
    path.endsWith('/index.html') ||
    document.getElementById('slot-hero') ||
    document.querySelector('.hero');

  if (isIndex) {
    initLanding();
  }

  // Håll top-user pill uppdaterad om login sker i annan flik
  window.addEventListener('storage', () => {
    updateTopUserPill(auth.getUser?.() || null);
  });
  setInterval(() => updateTopUserPill(auth.getUser?.() || null), 1500);
});
