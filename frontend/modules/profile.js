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
  const loginCard = document.getElementById('login-card');
  const ratingWrapper = document.getElementById('rating-form-wrapper');
  if (form) form.addEventListener('submit', handleRatingLoginSubmit);

  // On init, if user already logged in -> hide login and show rating form
  try {
    const user = auth.getUser();
    if (user) {
      if (loginCard) loginCard.classList.add('hidden');
      if (ratingWrapper) ratingWrapper.classList.remove('hidden');
      // Ensure the rating form submit handler is attached when the form is shown
      try {
        initRatingForm();
      } catch (err) {
        console.error('Could not init rating form', err);
      }
      // populate rater field if present
      const raterInput = document.querySelector('#rating-form input[name="rater"]') || document.getElementById('rater');
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
    // ensure UI updates same as Min profil: reload so init logic picks up stored user
    window.setTimeout(() => {
      window.location.reload();
      // alternatively: window.location.href = '/lämna-betyg';
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
  // Mark as bound so delegation fallback knows it's handled
  form.dataset.ratingBound = '1';
  form.addEventListener('submit', handleRatingSubmit);
  const resetBtn = document.getElementById('reset-form');
  if (resetBtn) resetBtn.addEventListener('click', () => form.reset());
}

// Delegation fallback: if the form is inserted dynamically or the normal init missed it,
// handle submit events for #rating-form here. This runs at module-load time.
document.addEventListener('submit', (e) => {
  try {
    const target = e.target;
    if (!target || !(target instanceof HTMLFormElement)) return;
    if (target.id !== 'rating-form') return;
    // If initRatingForm already bound the form, skip (dataset.ratingBound === '1')
    if (target.dataset && target.dataset.ratingBound === '1') return;
    // Prevent double handling and call the same handler
    e.preventDefault();
    handleRatingSubmit.call(target, e);
  } catch (err) {
    // swallow errors from fallback to avoid breaking other scripts
    console.error('rating-form delegation error', err);
  }
}, true);

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
    // Map to backend schema: subject, rating, rater, comment, proofRef
    const raterVal = form.querySelector('input[name="rater"]')?.value?.trim() || null;

    // Rapportfält
    const reportFlag = !!(form.querySelector('#reportFlag')?.checked || form.querySelector('[name="fraudReportEnabled"]')?.checked);
    const reportReason = form.querySelector('#reportReason')?.value || form.querySelector('[name="fraudType"]')?.value || null;
    const reportDate = form.querySelector('#reportDate')?.value || form.querySelector('[name="fraudDate"]')?.value || null;
    const reportTime = form.querySelector('#reportTime')?.value || form.querySelector('[name="fraudTime"]')?.value || null;
    const reportAmount = form.querySelector('#reportAmount')?.value || form.querySelector('[name="fraudAmount"]')?.value || null;
    const reportLink = form.querySelector('#reportLink')?.value || form.querySelector('[name="fraudLink"]')?.value || null;
    const reportText = form.querySelector('#reportText')?.value?.trim() || form.querySelector('[name="fraudDescription"]')?.value?.trim() || '';
    const reportConsent = !!(form.querySelector('#reportConsent')?.checked || form.querySelector('[name="fraudConsent"]')?.checked);

    // Compose a sensible report_text if structured fields are present
    let composedReportText = reportText || '';
    if (reportDate) composedReportText = `${composedReportText}${composedReportText ? '\n' : ''}Datum: ${reportDate}`;
    if (reportTime) composedReportText = `${composedReportText}${composedReportText ? '\n' : ''}Tid: ${reportTime}`;
    if (reportAmount) composedReportText = `${composedReportText}${composedReportText ? '\n' : ''}Belopp: ${reportAmount}`;
    if (reportLink) composedReportText = `${composedReportText}${composedReportText ? '\n' : ''}Länk: ${reportLink}`;

    const payload = {
      subject: ratedUserEmail,
      rating: Number(score),
      rater: raterVal || undefined,
      comment: comment || undefined,
      proofRef: proofRef || undefined,
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

// Hämta och rendera profil-data i DOM
async function loadProfileData() {
  try {
    // api.getCurrentCustomer försöker flera endpoints och fallback till localStorage
    const customer = await api.getCurrentCustomer();
    if (!customer) return;

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value === undefined || value === null || value === '' ? '-' : String(value);
    };

    set('profile-name', customer.fullName || customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`);
    set('profile-email', customer.email || customer.subjectRef || '-');
    set('profile-personalNumber', customer.personalNumber || customer.ssn || '-');
    set('profile-phone', customer.phone || '-');
    set('profile-addressStreet', customer.addressStreet || customer.street || '-');
    set('profile-addressZip', customer.addressZip || customer.zip || '-');
    set('profile-addressCity', customer.addressCity || customer.city || '-');
    set('profile-country', customer.country || '-');

    // Ratings summary if present
    if (typeof customer.average === 'number') {
      set('profile-score', String(customer.average));
      set('profile-score-count', String(customer.count || 0));
      const bar = document.getElementById('profile-score-bar');
      if (bar) {
        const fill = bar.querySelector('.score-bar-fill');
        if (fill) {
          const pct = Math.max(0, Math.min(100, (customer.average / 5) * 100));
          fill.style.width = `${pct}%`;
        }
      }
    }
  } catch (err) {
    console.error('Kunde inte ladda profil', err);
  }
}

// Hämta och rendera externa data (t.ex. postnummer-/ort-info eller externa counts)
async function loadExternalData() {
  try {
    const data = await api.getExternalDataForCurrentCustomer();
    if (!data) return;

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value === undefined || value === null || value === '' ? '-' : String(value);
    };

    // Try common keys
    set('ext-vehicles-count', data.vehicles ?? data.vehicleCount ?? data.vehiclesCount ?? '-');
    set('ext-properties-count', data.properties ?? data.propertyCount ?? data.propertiesCount ?? '-');
    // last-updated / location fallback
    const last = data.lastUpdatedText || data.lastUpdated || (data.postnummer ? `${data.postnummer} ${data.ort || ''}` : null) || data.source || '-';
    set('ext-last-updated', last);
  } catch (err) {
    console.error('Kunde inte ladda externa data', err);
  }
}

// Hämta och rendera mitt omdöme (average + lista)
async function loadMyRating() {
  try {
    const info = await api.getMyRating();
    if (!info) return;

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value === undefined || value === null || value === '' ? '-' : String(value);
    };

    if (typeof info.average === 'number') {
      set('profile-score', String(info.average));
      set('profile-score-count', String(info.count || 0));
      const bar = document.getElementById('profile-score-bar');
      if (bar) {
        const fill = bar.querySelector('.score-bar-fill');
        if (fill) {
          const pct = Math.max(0, Math.min(100, (info.average / 5) * 100));
          fill.style.width = `${pct}%`;
        }
      }
    }

    // Rendera individuella betyg i #ratings-list
    const listEl = document.getElementById('ratings-list');
    if (listEl) {
      if (!Array.isArray(info.ratings) || info.ratings.length === 0) {
        listEl.innerHTML = '<div class="tiny muted">Inga omdömen än.</div>';
      } else {
        let html = '';
        info.ratings.forEach((r) => {
          const d = new Date(r.createdAt);
          const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
          html += `<div class="rating-row"><div class="rating-main"><div class="rating-stars">${r.rating || r.score || ''} / 5</div><div class="rating-meta">${r.raterName || r.rater || ''} · ${dateStr}</div><div class="rating-comment-inline">${(r.comment||r.text||'').slice(0,400)}</div></div></div>`;
        });
        listEl.innerHTML = html;
      }
    }
  } catch (err) {
    console.error('Kunde inte ladda Mitt omdöme', err);
  }
}

export async function initProfilePage() {
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
      // Ladda profildata, externa data och egna betyg parallellt
      try {
        await Promise.all([loadProfileData(), loadExternalData(), loadMyRating()]);
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
