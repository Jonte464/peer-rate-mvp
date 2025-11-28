// main.js - Huvudfil som importerar och startar frontend-moduler
import auth from './auth.js';
import api from './api.js';
import { el, showNotice, clearNotice } from './utils.js';
import customerForm from './customer.js';
import { updateUserBadge, updateAvatars, initProfilePage, initRatingLogin } from './profile.js';
import { adminLoginForm, adminLogoutBtn } from './admin.js';

/**
 * Döljer eller visar login-hint på sidan Lämna betyg.
 */
function updateRatingLoginHint(user) {
  const hint = document.getElementById('rating-login-hint');
  if (!hint) return;

  if (user) {
    // Inloggad → göm texten
    hint.classList.add('hidden');
  } else {
    // Utloggad → visa texten
    hint.classList.remove('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  // Hämta inloggad användare
  const user = auth.getUser();

  // Uppdatera topp-badgen + avatar
  updateUserBadge(user);
  updateAvatars(user);

  if (customerForm) {
    console.log('Customer form loaded');
  }

  if (adminLoginForm && adminLogoutBtn) {
    console.log('Admin functionality loaded');
  }

  // Vilken sida är vi på?
  const path = window.location.pathname || '';

  // ------------------------
  // Initiera profilsidan
  // ------------------------
  if (
    path.includes('/min-profil') ||
    path.includes('profile.html') ||
    path.includes('/profile')
  ) {
    initProfilePage();
  }

  // ------------------------
  // Initiera Lämna betyg-sidan
  // ------------------------
  const isRatingPage =
    path.includes('/lamna-betyg') ||
    path.includes('index.html') ||
    document.getElementById('rating-card');

  if (isRatingPage) {
    initRatingLogin();
    updateRatingLoginHint(user); // 👈 Göm/visa login-hint här
  }
});
