// profile.js – Hanterar profilvisning och avatarer

import { el } from './utils.js';

// Visar / gömmer “Hej Jonathan”-badgen
export function updateUserBadge(user) {
  const userBadge = el('user-badge');
  const userBadgeName = el('user-badge-name');

  if (!userBadge || !userBadgeName) return;

  // Ingen inloggad → göm badgen
  if (!user) {
    userBadge.classList.add('hidden');
    userBadgeName.textContent = '';
    return;
  }

  const fullName = (user.fullName || '').trim();
  const firstName =
    fullName.split(/\s+/)[0] ||
    (user.email ? user.email.split('@')[0] : '');

  userBadgeName.textContent = firstName || 'Profil';
  userBadge.classList.remove('hidden');
}

// Uppdaterar avatarerna (badge + profilbild)
// Funkar även när user är null
export function updateAvatars(user) {
  const avatarUrl = localStorage.getItem('peerRateAvatar');

  let initials = 'P';
  if (user && typeof user === 'object') {
    if (user.fullName && typeof user.fullName === 'string' && user.fullName.trim() !== '') {
      initials = user.fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join('');
    } else if (user.email && typeof user.email === 'string' && user.email.length > 0) {
      initials = user.email[0].toUpperCase();
    }
  }

  const applyAvatar = (target) => {
    if (!target) return;
    if (avatarUrl) {
      target.style.backgroundImage = `url(${avatarUrl})`;
      target.textContent = '';
    } else {
      target.style.backgroundImage = 'none';
      target.textContent = initials;
    }
  };

  applyAvatar(el('user-badge-avatar'));
  applyAvatar(el('profile-avatar-preview'));
}

// ----------------------
// Login på Min profil
// ----------------------
import { showNotification } from './utils.js';
import { login } from './auth.js';
import auth from './auth.js';

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
  const password = form.querySelector('input[name="password"]')?.value || '';

  if (!email || !password) {
    showNotification('error', 'Fyll i både e-post och lösenord.', 'login-status');
    return;
  }

  try {
    const res = await login(email, password);
    if (!res || res.ok === false) {
      const message = res?.error || 'Inloggningen misslyckades. Kontrollera uppgifterna.';
      showNotification('error', message, 'login-status');
      return;
    }

    showNotification('success', 'Du är nu inloggad.', 'login-status');
    // Ladda om sidan efter kort för att uppdatera UI (liten fördröjning så användaren hinner se notisen)
    window.setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (err) {
    console.error('handleLoginSubmit error', err);
    showNotification('error', 'Tekniskt fel vid inloggning. Försök igen om en stund.', 'login-status');
  }
}

// ----------------------
// Lämna-betyg: login på separat sida (/lamna-betyg)
// ----------------------
export function initRatingLogin() {
  const form = document.getElementById('rating-login-form');
  if (!form) return;
  form.addEventListener('submit', handleRatingLoginSubmit);
}

async function handleRatingLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
  const password = form.querySelector('input[name="password"]')?.value || '';
  if (!email || !password) {
    showNotification('error', 'Fyll i både e-post och lösenord.', 'login-status');
    return;
  }
  try {
    const res = await login(email, password);
    if (!res || res.ok === false) {
      const message = res?.error || 'Inloggningen misslyckades. Kontrollera uppgifterna.';
      showNotification('error', message, 'login-status');
      return;
    }
    showNotification('success', 'Du är nu inloggad.', 'login-status');
    window.setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (err) {
    console.error('handleRatingLoginSubmit error', err);
    showNotification('error', 'Tekniskt fel vid inloggning. Försök igen om en stund.', 'login-status');
  }
}

// ----------------------
// Logout-knapp
// ----------------------
import { logout } from './auth.js';

export function initLogoutButton() {
  const btn = document.getElementById('logout-btn') || document.getElementById('logout-button');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await logout();
      showNotification('success', 'Du är nu utloggad.', 'notice');
      window.setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Logout error', err);
      showNotification('error', 'Kunde inte logga ut. Försök igen.', 'notice');
    }
  });
}

// ----------------------
// Rating form (skicka betyg)
// ----------------------
import api from './api.js';

export function initRatingForm() {
  const form = document.getElementById('rating-form');
  if (!form) return;
  form.addEventListener('submit', handleRatingSubmit);
  const resetBtn = document.getElementById('reset-form');
  if (resetBtn) resetBtn.addEventListener('click', () => form.reset());
}

async function handleRatingSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const ratedUserEmail = form.querySelector('input[name="ratedUserEmail"]')?.value?.trim() || '';
  const score = Number(form.querySelector('select[name="score"]')?.value || 0);
  const comment = form.querySelector('textarea[name="comment"]')?.value?.trim() || '';
  const proofRef = form.querySelector('input[name="proofRef"]')?.value?.trim() || '';

  if (!ratedUserEmail || !score) {
    showNotification('error', 'Fyll i alla obligatoriska fält innan du skickar.', 'notice');
    return;
  }

  const body = { ratedUserEmail, score, comment, proofRef };
  try {
    const result = await api.createRating(body);
    if (!result || result.ok === false) {
      const message = result?.error || 'Kunde inte spara betyget.';
      showNotification('error', message, 'notice');
      return;
    }
    showNotification('success', 'Tack för ditt omdöme!', 'notice');
    form.reset();
  } catch (err) {
    console.error('handleRatingSubmit error', err);
    showNotification('error', 'Tekniskt fel. Försök igen om en stund.', 'notice');
  }
}

export function initProfilePage() {
  console.log('initProfilePage');
  const form = document.getElementById('login-form');
  if (!form) {
    console.warn('Login form not found');
    return;
  }
  form.addEventListener('submit', handleLoginSubmit);
  // initera logout-knapp och rating-form om de finns på sidan
  try {
    initLogoutButton();
    initRatingForm();
  } catch (err) {
    console.error('initProfilePage auxiliary inits error', err);
  }
  // Om användaren redan är inloggad, visa profilen istället för login-formuläret
  try {
    const user = auth.getUser();
    const loginCard = document.getElementById('login-card');
    const profileRoot = document.getElementById('profile-root');
    if (user) {
      if (loginCard) loginCard.classList.add('hidden');
      if (profileRoot) profileRoot.classList.remove('hidden');
      // uppdatera UI
      updateUserBadge(user);
      updateAvatars(user);
    } else {
      if (loginCard) loginCard.classList.remove('hidden');
      if (profileRoot) profileRoot.classList.add('hidden');
    }
  } catch (err) {
    console.error('initProfilePage check user error', err);
  }
}
