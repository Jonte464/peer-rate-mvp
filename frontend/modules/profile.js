// frontend/modules/profile.js – Hanterar profilvisning, avatarer, profil-UI och Tradera-/eBay-koppling

import { el, showNotification } from './utils.js';
import auth, { login, logout } from './auth.js';
import api from './api.js';
import { initTraderaSection } from './profileTradera.js';
import { initEbaySection } from './profileEbay.js';
import { renderPRating, loadMyRating } from './profileRatings.js';
import { initRatingForm } from './ratingForm.js';
import { t, applyLang } from './landing/language.js';

export { initRatingLogin } from './ratingForm.js'; // vidareexport för /rate.html

function getAvatarKey(user) {
  if (!user || typeof user !== 'object') return 'peerRateAvatar:default';

  const id =
    (user.email && String(user.email).toLowerCase()) ||
    (user.subjectRef && String(user.subjectRef).toLowerCase()) ||
    'default';

  return `peerRateAvatar:${id}`;
}

export function updateUserBadge(user) {
  const userBadge = el('user-badge');
  const userBadgeName = el('user-badge-name');
  if (!userBadge || !userBadgeName) return;

  if (!user) {
    userBadge.classList.add('hidden');
    userBadgeName.textContent = '';
    return;
  }

  const fullName = (user.fullName || '').trim();
  const firstName =
    fullName.split(/\s+/)[0] ||
    (user.email ? user.email.split('@')[0] : '');

  userBadgeName.textContent = firstName || t('profile_default_name', 'Profil');
  userBadge.classList.remove('hidden');
}

export function updateAvatars(user) {
  const key = getAvatarKey(user);
  const avatarUrl = localStorage.getItem(key);

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

function initAvatarUpload() {
  const input = document.getElementById('profile-avatar-input');
  if (!input) return;

  const openPicker = () => {
    try {
      input.click();
    } catch {}
  };

  const badgeAvatar = document.getElementById('user-badge-avatar');
  if (badgeAvatar && !badgeAvatar.dataset.avatarBound) {
    badgeAvatar.dataset.avatarBound = 'true';
    badgeAvatar.style.cursor = 'pointer';
    badgeAvatar.addEventListener('click', openPicker);
  }

  const previewAvatar = document.getElementById('profile-avatar-preview');
  if (previewAvatar && !previewAvatar.dataset.avatarBound) {
    previewAvatar.dataset.avatarBound = 'true';
    previewAvatar.style.cursor = 'pointer';
    previewAvatar.addEventListener('click', openPicker);
  }

  if (!input.dataset.avatarInputBound) {
    input.dataset.avatarInputBound = 'true';
    input.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const user = auth.getUser();
          const key = getAvatarKey(user);
          localStorage.setItem(key, reader.result);
          updateAvatars(user);
        } catch (err) {
          console.error('Kunde inte spara/uppdatera avatar', err);
        }
      };
      reader.readAsDataURL(file);
    });
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
  const password = form.querySelector('input[name="password"]')?.value || '';

  if (!email || !password) {
    showNotification('error', t('profile_login_error_missing_fields', 'Fyll i både e-post och lösenord.'), 'login-status');
    return;
  }

  try {
    const res = await login(email, password);
    if (!res || res.ok === false) {
      const message = res?.error || t('profile_login_error_failed', 'Inloggningen misslyckades. Kontrollera uppgifterna.');
      showNotification('error', message, 'login-status');
      return;
    }

    showNotification('success', t('profile_login_success', 'Du är nu inloggad.'), 'login-status');
    window.setTimeout(() => window.location.reload(), 500);
  } catch (err) {
    console.error('handleLoginSubmit error', err);
    showNotification('error', t('profile_login_error_technical', 'Tekniskt fel vid inloggning. Försök igen om en stund.'), 'login-status');
  }
}

export function initLogoutButton() {
  const btn = document.getElementById('logout-btn') || document.getElementById('logout-button');
  if (!btn || btn.dataset.logoutBound) return;

  btn.dataset.logoutBound = 'true';
  btn.addEventListener('click', async () => {
    try {
      await logout();
      showNotification('success', t('profile_logout_success', 'Du är nu utloggad.'), 'notice');
      window.setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      console.error('Logout error', err);
      showNotification('error', t('profile_logout_error', 'Kunde inte logga ut. Försök igen.'), 'notice');
    }
  });
}

function translateAddressStatus(rawStatus) {
  if (!rawStatus) return '-';

  const s = String(rawStatus).toUpperCase();

  switch (s) {
    case 'VERIFIED':
      return t('profile_address_status_verified', 'Bekräftad (adress hittad i adressregister)');
    case 'FROM_PROFILE':
      return t('profile_address_status_from_profile', 'Från din profil (ej verifierad externt)');
    case 'NO_EXTERNAL_DATA':
      return t('profile_address_status_no_external_data', 'Ingen extern data');
    case 'NO_ADDRESS_INPUT':
      return t('profile_address_status_no_address_input', 'Ingen adress angiven');
    case 'NO_ADDRESS_IN_RESPONSE':
      return t('profile_address_status_no_address_in_response', 'Ingen adress i svaret från tjänsten');
    case 'NO_ADDRESS':
      return t('profile_address_status_no_address', 'Ingen adress');
    case 'LOOKUP_FAILED':
      return t('profile_address_status_lookup_failed', 'Tekniskt fel vid adresskontroll');
    default:
      return t('profile_address_status_unknown', 'Okänd status ({status})', { status: s });
  }
}

async function loadProfileData() {
  try {
    let customer = null;

    try {
      customer = await api.getCurrentCustomer();
    } catch {
      customer = null;
    }

    if (!customer) {
      const local = auth.getUser && auth.getUser();
      if (!local) return;

      customer = {
        fullName: local.fullName || `${local.firstName || ''} ${local.lastName || ''}`.trim(),
        email: local.email || '',
        firstName: local.firstName,
        lastName: local.lastName,
        title: (local.title || '').trim() || undefined,
      };
    }

    const set = (id, value) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.textContent = value === undefined || value === null || value === '' ? '-' : String(value);
    };

    set(
      'profile-name',
      customer.fullName || customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
    );
    set('profile-email', customer.email || customer.subjectRef || '-');
    set('profile-personalNumber', customer.personalNumber || customer.ssn || '-');
    set('profile-phone', customer.phone || '-');
    set('profile-addressStreet', customer.addressStreet || customer.street || '-');
    set('profile-addressZip', customer.addressZip || customer.zip || '-');
    set('profile-addressCity', customer.addressCity || customer.city || '-');
    set('profile-country', customer.country || '-');

    if (typeof customer.average === 'number') {
      set('profile-score', String(customer.average));
      set('profile-score-count', String(customer.count || 0));

      const fill = document.getElementById('profile-score-bar');
      if (fill) {
        const pct = Math.max(0, Math.min(100, (customer.average / 5) * 100));
        fill.style.width = `${pct}%`;
      }

      renderPRating(customer.average);
    }
  } catch (err) {
    console.error('Kunde inte ladda profil', err);
  }
}

async function loadExternalData() {
  try {
    const section = document.getElementById('external-data-section');
    const data = await api.getExternalDataForCurrentCustomer();

    if (!data || data.ok === false) {
      if (section) section.classList.add('hidden');
      return;
    }

    let anyVisible = false;

    const setAndToggle = (id, value) => {
      const node = document.getElementById(id);
      if (!node) return;

      const li = node.closest && node.closest('li');

      if (value === undefined || value === null || value === '') {
        node.textContent = '';
        if (li) li.classList.add('hidden');
      } else {
        node.textContent = String(value);
        if (li) li.classList.remove('hidden');
        anyVisible = true;
      }
    };

    setAndToggle('ext-vehicles-count', data.vehicles);
    setAndToggle('ext-properties-count', data.properties);
    setAndToggle('ext-last-updated', data.lastUpdated);

    const addrEl = document.querySelector('[data-field="externalAddressLine"]');
    const statusEl = document.querySelector('[data-field="externalAddressStatus"]');

    const setSpecial = (node, value) => {
      if (!node) return;

      const li = node.closest && node.closest('li');

      if (value === undefined || value === null || value === '') {
        node.textContent = '';
        if (li) li.classList.add('hidden');
      } else {
        node.textContent = String(value);
        if (li) li.classList.remove('hidden');
        anyVisible = true;
      }
    };

    setSpecial(addrEl, data.validatedAddress);
    setSpecial(statusEl, translateAddressStatus(data.addressStatus));

    if (section) {
      if (!anyVisible) section.classList.add('hidden');
      else section.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Kunde inte ladda externa data', err);
    const section = document.getElementById('external-data-section');
    if (section) section.classList.add('hidden');
  }
}

export async function initProfilePage() {
  console.log('initProfilePage');

  const form = document.getElementById('login-form');
  if (!form) {
    console.warn('Login form not found');
    return;
  }

  if (!form.dataset.loginBound) {
    form.dataset.loginBound = 'true';
    form.addEventListener('submit', handleLoginSubmit);
  }

  try {
    initLogoutButton();
    initRatingForm();
    initAvatarUpload();
  } catch (err) {
    console.error('initProfilePage auxiliary inits error', err);
  }

  try {
    const user = auth.getUser();
    const loginCard = document.getElementById('login-card');
    const profileRoot = document.getElementById('profile-root');

    if (user) {
      if (loginCard) loginCard.classList.add('hidden');
      if (profileRoot) profileRoot.classList.remove('hidden');

      updateUserBadge(user);
      updateAvatars(user);

      try {
        await Promise.all([
          loadProfileData(),
          loadExternalData(),
          loadMyRating(),
          initTraderaSection(),
          initEbaySection(),
        ]);
      } catch (err) {
        console.error('profile data loaders error', err);
      }

      applyLang(document);
    } else {
      if (loginCard) loginCard.classList.remove('hidden');
      if (profileRoot) profileRoot.classList.add('hidden');
      applyLang(document);
    }
  } catch (err) {
    console.error('initProfilePage check user error', err);
  }
}