// frontend/modules/profile.js – Hanterar profilvisning, avatarer och profil-UI

import { el, showNotification } from './utils.js';
import auth, { login, logout } from './auth.js';
import api from './api.js';
import { renderPRating, loadMyRating, rerenderRatingWidgetsFromCache } from './profileRatings.js';
import { initRatingForm } from './ratingForm.js';
import { t, applyLang } from './landing/language.js';

export { initRatingLogin } from './ratingForm.js'; // vidareexport för /rate.html

let latestExternalData = null;
let languageChangeBound = false;

const LEGACY_AVATAR_KEY = 'peerrate.avatar.dataUrl';

function normalizeUserIdentity(user) {
  if (!user || typeof user !== 'object') {
    return {
      storageId: 'default',
      email: '',
      fullName: '',
    };
  }

  const email =
    (user.email && String(user.email).trim().toLowerCase()) ||
    (user.customer?.email && String(user.customer.email).trim().toLowerCase()) ||
    '';

  const subjectRef =
    (user.subjectRef && String(user.subjectRef).trim().toLowerCase()) ||
    (user.customer?.subjectRef && String(user.customer.subjectRef).trim().toLowerCase()) ||
    '';

  const id =
    (user.id && String(user.id).trim().toLowerCase()) ||
    (user.customer?.id && String(user.customer.id).trim().toLowerCase()) ||
    '';

  const fullName =
    (user.fullName && String(user.fullName).trim()) ||
    (user.customer?.fullName && String(user.customer.fullName).trim()) ||
    `${user.firstName || user.customer?.firstName || ''} ${user.lastName || user.customer?.lastName || ''}`.trim();

  const storageId = email || subjectRef || id || 'default';

  return {
    storageId,
    email,
    fullName,
  };
}

function getAvatarKey(user) {
  const identity = normalizeUserIdentity(user);
  return `peerRateAvatar:${identity.storageId}`;
}

function getInitials(user) {
  const identity = normalizeUserIdentity(user);

  if (identity.fullName) {
    return identity.fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() || '')
      .join('') || 'P';
  }

  if (identity.email) {
    return identity.email[0]?.toUpperCase() || 'P';
  }

  return 'P';
}

function getStoredAvatar(user) {
  try {
    const key = getAvatarKey(user);
    const direct = localStorage.getItem(key);
    if (direct) return direct;

    // Migrera gammal global nyckel till per-user nyckel om sådan finns
    const legacy = localStorage.getItem(LEGACY_AVATAR_KEY);
    if (legacy && user) {
      localStorage.setItem(key, legacy);
      return legacy;
    }

    return null;
  } catch {
    return null;
  }
}

function setStoredAvatar(user, dataUrl) {
  try {
    const key = getAvatarKey(user);
    localStorage.setItem(key, dataUrl);
  } catch (err) {
    console.error('Could not store avatar', err);
  }
}

function setAvatarOnTarget(target, avatarUrl, initials) {
  if (!target) return;

  if (avatarUrl) {
    target.style.backgroundImage = `url("${avatarUrl}")`;
    target.style.backgroundSize = 'cover';
    target.style.backgroundPosition = 'center';
    target.style.backgroundRepeat = 'no-repeat';
    target.textContent = '';
    target.setAttribute('data-has-avatar', 'true');
  } else {
    target.style.backgroundImage = 'none';
    target.style.backgroundSize = '';
    target.style.backgroundPosition = '';
    target.style.backgroundRepeat = '';
    target.textContent = initials;
    target.setAttribute('data-has-avatar', 'false');
  }
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

  const identity = normalizeUserIdentity(user);
  const firstName =
    identity.fullName.split(/\s+/)[0] ||
    (identity.email ? identity.email.split('@')[0] : '');

  userBadgeName.textContent = firstName || t('profile_default_name', 'Profile');
  userBadge.classList.remove('hidden');
}

export function updateAvatars(user) {
  const avatarUrl = getStoredAvatar(user);
  const initials = getInitials(user);

  setAvatarOnTarget(el('user-badge-avatar'), avatarUrl, initials);
  setAvatarOnTarget(el('profile-avatar-preview'), avatarUrl, initials);

  const badgeAvatar = document.getElementById('user-badge-avatar');
  if (badgeAvatar) {
    badgeAvatar.setAttribute('title', t('profile_avatar_title', 'Click to change image'));
  }

  const previewAvatar = document.getElementById('profile-avatar-preview');
  if (previewAvatar) {
    previewAvatar.setAttribute('title', t('profile_avatar_title', 'Click to change image'));
  }
}

function setAvatarStatus(messageKey, fallback) {
  const status = document.getElementById('profile-avatar-status');
  if (!status) return;
  status.textContent = t(messageKey, fallback);
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

      if (!file.type || !file.type.startsWith('image/')) {
        setAvatarStatus('profile_avatar_error_filetype', 'Välj en bildfil.');
        input.value = '';
        return;
      }

      const maxBytes = 2 * 1024 * 1024;
      if (file.size > maxBytes) {
        setAvatarStatus('profile_avatar_error_size', 'Bilden är för stor. Välj en bild under 2 MB.');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const user = auth.getUser?.() || null;
          if (!user) {
            setAvatarStatus('profile_avatar_error_login', 'Du måste vara inloggad för att spara profilbild.');
            return;
          }

          const result = typeof reader.result === 'string' ? reader.result : '';
          if (!result) {
            setAvatarStatus('profile_avatar_error_read', 'Kunde inte läsa bildfilen.');
            return;
          }

          setStoredAvatar(user, result);
          updateAvatars(user);
          setAvatarStatus('profile_avatar_saved', 'Profilbilden sparades lokalt i din webbläsare.');
        } catch (err) {
          console.error('Kunde inte spara/uppdatera avatar', err);
          setAvatarStatus('profile_avatar_error_save', 'Kunde inte spara profilbilden.');
        } finally {
          input.value = '';
        }
      };

      reader.onerror = () => {
        setAvatarStatus('profile_avatar_error_read', 'Kunde inte läsa bildfilen.');
        input.value = '';
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
    showNotification(
      'error',
      t('profile_login_error_missing_fields', 'Please enter both email and password.'),
      'login-status'
    );
    return;
  }

  try {
    const res = await login(email, password);
    if (!res || res.ok === false) {
      const message =
        res?.error ||
        t('profile_login_error_failed', 'Login failed. Please check your details.');
      showNotification('error', message, 'login-status');
      return;
    }

    showNotification(
      'success',
      t('profile_login_success', 'You are now logged in.'),
      'login-status'
    );

    window.setTimeout(() => window.location.reload(), 500);
  } catch (err) {
    console.error('handleLoginSubmit error', err);
    showNotification(
      'error',
      t('profile_login_error_technical', 'Technical error during login. Please try again shortly.'),
      'login-status'
    );
  }
}

export function initLogoutButton() {
  const btn = document.getElementById('logout-btn') || document.getElementById('logout-button');
  if (!btn || btn.dataset.logoutBound) return;

  btn.dataset.logoutBound = 'true';
  btn.addEventListener('click', async () => {
    try {
      await logout();
      showNotification(
        'success',
        t('profile_logout_success', 'You are now logged out.'),
        'notice'
      );
      window.setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      console.error('Logout error', err);
      showNotification(
        'error',
        t('profile_logout_error', 'Could not log out. Please try again.'),
        'notice'
      );
    }
  });
}

function translateAddressStatus(rawStatus) {
  if (!rawStatus) return '-';

  const s = String(rawStatus).toUpperCase();

  switch (s) {
    case 'VERIFIED':
      return t('profile_address_status_verified', 'Verified (address found in address registry)');
    case 'FROM_PROFILE':
      return t('profile_address_status_from_profile', 'From your profile (not externally verified)');
    case 'NO_EXTERNAL_DATA':
      return t('profile_address_status_no_external_data', 'No external data');
    case 'NO_ADDRESS_INPUT':
      return t('profile_address_status_no_address_input', 'No address entered');
    case 'NO_ADDRESS_IN_RESPONSE':
      return t('profile_address_status_no_address_in_response', 'No address in service response');
    case 'NO_ADDRESS':
      return t('profile_address_status_no_address', 'No address');
    case 'LOOKUP_FAILED':
      return t('profile_address_status_lookup_failed', 'Technical error during address validation');
    default:
      return t('profile_address_status_unknown', 'Unknown status ({status})', { status: s });
  }
}

function rerenderExternalDataFromCache() {
  const section = document.getElementById('external-data-section');
  if (!section || !latestExternalData) return;

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

  setAndToggle('ext-vehicles-count', latestExternalData.vehicles);
  setAndToggle('ext-properties-count', latestExternalData.properties);
  setAndToggle('ext-last-updated', latestExternalData.lastUpdated);

  const addrEl = document.querySelector('[data-field="externalAddressLine"]');
  const statusEl = document.querySelector('[data-field="externalAddressStatus"]');

  setSpecial(addrEl, latestExternalData.validatedAddress);
  setSpecial(statusEl, translateAddressStatus(latestExternalData.addressStatus));

  if (!anyVisible) section.classList.add('hidden');
  else section.classList.remove('hidden');

  applyLang(document);
}

function bindLanguageChangeHandler() {
  if (languageChangeBound) return;
  languageChangeBound = true;

  window.addEventListener('peerrate:language-changed', () => {
    const user = auth.getUser?.() || null;
    updateUserBadge(user);
    updateAvatars(user);
    rerenderExternalDataFromCache();
    rerenderRatingWidgetsFromCache();
    applyLang(document);
  });
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
        id: local.id || local.customer?.id,
        subjectRef: local.subjectRef || local.customer?.subjectRef,
        fullName: local.fullName || local.customer?.fullName || `${local.firstName || local.customer?.firstName || ''} ${local.lastName || local.customer?.lastName || ''}`.trim(),
        email: local.email || local.customer?.email || '',
        firstName: local.firstName || local.customer?.firstName,
        lastName: local.lastName || local.customer?.lastName,
        title: (local.title || local.customer?.title || '').trim() || undefined,
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

    latestExternalData = data || null;

    if (!data || data.ok === false) {
      if (section) section.classList.add('hidden');
      return;
    }

    rerenderExternalDataFromCache();
  } catch (err) {
    console.error('Kunde inte ladda externa data', err);
    latestExternalData = null;
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

  bindLanguageChangeHandler();

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
    const user = auth.getUser?.() || null;
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
        ]);
      } catch (err) {
        console.error('profile data loaders error', err);
      }

      updateAvatars(auth.getUser?.() || user);
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