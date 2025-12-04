// v1.2 – Tradera summary + enkla betygsformulär per affär

// profile.js – Hanterar profilvisning, avatarer, profil-UI och Tradera-koppling

import { el, showNotification } from './utils.js';
import auth, { login, logout } from './auth.js';
import api from './api.js';
import { initTraderaSection } from './profileTradera.js';
import { renderPRating, loadMyRating } from './profileRatings.js';

// Hjälpare: nyckel i localStorage per användare
function getAvatarKey(user) {
  if (!user || typeof user !== 'object') {
    return 'peerRateAvatar:default';
  }
  const id =
    (user.email && String(user.email).toLowerCase()) ||
    (user.subjectRef && String(user.subjectRef).toLowerCase()) ||
    'default';
  return `peerRateAvatar:${id}`;
}

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

// ----------------------
// Profilbild – uppladdning
// ----------------------
function initAvatarUpload() {
  const input = document.getElementById('profile-avatar-input');
  if (!input) return;

  input.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const user = auth.getUser();
        const key = getAvatarKey(user);
        // Spara bara lokalt i webbläsaren, per användare
        localStorage.setItem(key, reader.result);
        updateAvatars(user);
      } catch (err) {
        console.error('Kunde inte spara/uppdatera avatar', err);
      }
    };
    reader.readAsDataURL(file);
  });
}

// ----------------------
// Login på Min profil
// ----------------------

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
  const loginCard = document.getElementById('login-card');
  const ratingWrapper = document.getElementById('rating-form-wrapper');
  if (form) form.addEventListener('submit', handleRatingLoginSubmit);

  try {
    const user = auth.getUser();
    if (user) {
      if (loginCard) loginCard.classList.add('hidden');
      if (ratingWrapper) ratingWrapper.classList.remove('hidden');
      try {
        initRatingForm();
      } catch (err) {
        console.error('Could not init rating form', err);
      }
      const raterInput =
        document.querySelector('#rating-form input[name="rater"]') ||
        document.getElementById('rater');
      if (raterInput && user.email) raterInput.value = user.email;
    } else {
      if (loginCard) loginCard.classList.remove('hidden');
      if (ratingWrapper) ratingWrapper.classList.add('hidden');
    }
  } catch (err) {
    console.error('initRatingLogin check user error', err);
  }
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

export function initRatingForm() {
  const form = document.getElementById('rating-form');
  if (!form) return;
  form.dataset.ratingBound = '1';
  form.addEventListener('submit', handleRatingSubmit);
  const resetBtn = document.getElementById('reset-form');
  if (resetBtn) resetBtn.addEventListener('click', () => form.reset());
}

document.addEventListener(
  'submit',
  (e) => {
    try {
      const target = e.target;
      if (!target || !(target instanceof HTMLFormElement)) return;
      if (target.id !== 'rating-form') return;
      if (target.dataset && target.dataset.ratingBound === '1') return;
      e.preventDefault();
      handleRatingSubmit.call(target, e);
    } catch (err) {
      console.error('rating-form delegation error', err);
    }
  },
  true
);

async function handleRatingSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const ratedUserEmail =
    form.querySelector('input[name="ratedUserEmail"]')?.value?.trim() || '';
  const score = Number(form.querySelector('select[name="score"]')?.value || 0);
  const comment =
    form.querySelector('textarea[name="comment"]')?.value?.trim() || '';
  const proofRef =
    form.querySelector('input[name="proofRef"]')?.value?.trim() || '';

  const sourceRaw = form.querySelector('select[name="source"]')?.value || '';

  if (!ratedUserEmail || !score) {
    showNotification(
      'error',
      'Fyll i alla obligatoriska fält innan du skickar.',
      'notice'
    );
    return;
  }

  try {
    const raterVal =
      form.querySelector('input[name="rater"]')?.value?.trim() || null;

    const reportFlag = !!(
      form.querySelector('#reportFlag')?.checked ||
      form.querySelector('[name="fraudReportEnabled"]')?.checked
    );
    const reportReason =
      form.querySelector('#reportReason')?.value ||
      form.querySelector('[name="fraudType"]')?.value ||
      null;
    const reportDate =
      form.querySelector('#reportDate')?.value ||
      form.querySelector('[name="fraudDate"]')?.value ||
      null;
    const reportTime =
      form.querySelector('#reportTime')?.value ||
      form.querySelector('[name="fraudTime"]')?.value ||
      null;
    const reportAmount =
      form.querySelector('#reportAmount')?.value ||
      form.querySelector('[name="fraudAmount"]')?.value ||
      null;
    const reportLink =
      form.querySelector('#reportLink')?.value ||
      form.querySelector('[name="fraudLink"]')?.value ||
      null;
    const reportText =
      form.querySelector('#reportText')?.value?.trim() ||
      form.querySelector('[name="fraudDescription"]')?.value?.trim() ||
      '';
    const reportConsent = !!(
      form.querySelector('#reportConsent')?.checked ||
      form.querySelector('[name="fraudConsent"]')?.checked
    );

    let composedReportText = reportText || '';
    if (reportDate)
      composedReportText = `${composedReportText}${
        composedReportText ? '\n' : ''
      }Datum: ${reportDate}`;
    if (reportTime)
      composedReportText = `${composedReportText}${
        composedReportText ? '\n' : ''
      }Tid: ${reportTime}`;
    if (reportAmount)
      composedReportText = `${composedReportText}${
        composedReportText ? '\n' : ''
      }Belopp: ${reportAmount}`;
    if (reportLink)
      composedReportText = `${composedReportText}${
        composedReportText ? '\n' : ''
      }Länk: ${reportLink}`;

    const payload = {
      subject: ratedUserEmail,
      rating: Number(score),
      rater: raterVal || undefined,
      comment: comment || undefined,
      proofRef: proofRef || undefined,
      source: sourceRaw || undefined,
      report: undefined,
    };

    if (reportFlag || reportReason || composedReportText) {
      payload.report = {
        report_flag: !!reportFlag,
        report_reason: reportReason || null,
        report_text: composedReportText || null,
        evidence_url: (form.querySelector('#evidenceUrl')?.value || null) || null,
        report_consent: !!reportConsent,
      };
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    console.log('Sending rating payload:', payload);
    const result = await api.createRating(payload);
    console.log('Rating response:', result);
    if (!result || result.ok === false) {
      const message = result?.error || 'Kunde inte spara betyget.';
      showNotification('error', message, 'notice');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    showNotification('success', 'Tack för ditt omdöme!', 'notice');
    form.reset();
    if (submitBtn) submitBtn.disabled = false;
  } catch (err) {
    console.error('handleRatingSubmit error', err);
    showNotification('error', 'Tekniskt fel. Försök igen om en stund.', 'notice');
  }
}

// ----------------------
// Hjälpare: översätt adressstatus till svenska
// ----------------------
function translateAddressStatus(rawStatus) {
  if (!rawStatus) return '-';
  const s = String(rawStatus).toUpperCase();

  switch (s) {
    case 'VERIFIED':
      return 'Bekräftad (adress hittad i adressregister)';
    case 'FROM_PROFILE':
      return 'Från din profil (ej verifierad externt)';
    case 'NO_EXTERNAL_DATA':
      return 'Ingen extern data';
    case 'NO_ADDRESS_INPUT':
      return 'Ingen adress angiven';
    case 'NO_ADDRESS_IN_RESPONSE':
      return 'Ingen adress i svaret från tjänsten';
    case 'NO_ADDRESS':
      return 'Ingen adress';
    case 'LOOKUP_FAILED':
      return 'Tekniskt fel vid adresskontroll';
    default:
      return `Okänd status (${s})`;
  }
}

// ----------------------
// Hämta och rendera profil-data i DOM
// ----------------------
async function loadProfileData() {
  try {
    const customer = await api.getCurrentCustomer();
    if (!customer) return;

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent =
        value === undefined || value === null || value === '' ? '-' : String(value);
    };

    set(
      'profile-name',
      customer.fullName ||
        customer.name ||
        `${customer.firstName || ''} ${customer.lastName || ''}`
    );
    set('profile-email', customer.email || customer.subjectRef || '-');
    set('profile-personalNumber', customer.personalNumber || customer.ssn || '-');
    set('profile-phone', customer.phone || '-');
    set(
      'profile-addressStreet',
      customer.addressStreet || customer.street || '-'
    );
    set('profile-addressZip', customer.addressZip || customer.zip || '-');
    set('profile-addressCity', customer.addressCity || customer.city || '-');
    set('profile-country', customer.country || '-');

    if (typeof customer.average === 'number') {
      set('profile-score', String(customer.average));
      set('profile-score-count', String(customer.count || 0));
      const fill = document.getElementById('profile-score-bar');
      if (fill) {
        const pct = Math.max(
          0,
          Math.min(100, (customer.average / 5) * 100)
        );
        fill.style.width = `${pct}%`;
      }
      // Visa direkt en rating-graf baserat på profilens snitt
      renderPRating(customer.average);
    }
  } catch (err) {
    console.error('Kunde inte ladda profil', err);
  }
}

// ----------------------
// Hämta och rendera EXTERN data
// ----------------------
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
      const el = document.getElementById(id);
      if (!el) return;
      const li = el.closest && el.closest('li');

      if (value === undefined || value === null || value === '') {
        el.textContent = '';
        if (li) li?.classList.add('hidden');
      } else {
        el.textContent = String(value);
        if (li) li?.classList.remove('hidden');
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
        if (li) li?.classList.add('hidden');
      } else {
        node.textContent = String(value);
        if (li) li?.classList.remove('hidden');
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

// ----------------------
// Initiera profilsidan
// ----------------------

export async function initProfilePage() {
  console.log('initProfilePage');
  const form = document.getElementById('login-form');
  if (!form) {
    console.warn('Login form not found');
    return;
  }
  form.addEventListener('submit', handleLoginSubmit);

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
        ]);
      } catch (err) {
        console.error('profile data loaders error', err);
      }
    } else {
      if (loginCard) loginCard.classList.remove('hidden');
      if (profileRoot) profileRoot.classList.add('hidden');
    }
  } catch (err) {
    console.error('initProfilePage check user error', err);
  }
}
