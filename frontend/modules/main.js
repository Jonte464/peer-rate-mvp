// frontend/modules/main.js
// Huvudfil som startar rätt saker beroende på vilken sida man är på.

import auth from './auth.js';
import { updateUserBadge, updateAvatars, initProfilePage, initRatingLogin } from './profile.js';
import { adminLoginForm, adminLogoutBtn } from './admin.js';
import customerForm from './customer.js';

import { initLanding } from './landing/init.js';
import { updateTopUserPill, initUserDropdown } from './landing/topUser.js';

/**
 * Döljer eller visar login-hint på sidan Lämna betyg.
 */
function updateRatingLoginHint(user) {
  const hint = document.getElementById('rating-login-hint');
  if (!hint) return;
  if (user) hint.classList.add('hidden');
  else hint.classList.remove('hidden');
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  const user = auth.getUser?.() || null;

  updateUserBadge(user);
  updateAvatars(user);
  updateTopUserPill(user);

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
  if (path.includes('/min-profil') || path.includes('profile.html') || path.includes('/profile')) {
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
