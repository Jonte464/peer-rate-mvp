// v1.2 – Tradera summary + enkla betygsformulär per affär

// profile.js – Hanterar profilvisning, avatarer, profil-UI och Tradera-/eBay-koppling

import { el, showNotification } from './utils.js';
import auth, { login, logout } from './auth.js';
import api from './api.js';
import { initTraderaSection } from './profileTradera.js';
import { initEbaySection } from './profileEbay.js';
import { renderPRating, loadMyRating } from './profileRatings.js';
import { initRatingForm } from './ratingForm.js';
import { initQuestionnaire } from './profileQuestionnaire.js';
import { initInviteForm } from './inviteForm.js';
export { initRatingLogin } from './ratingForm.js'; // vidareexport för /lamna-betyg-sidan

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
    let customer = null;
    try {
      customer = await api.getCurrentCustomer();
    } catch (e) {
      customer = null;
    }

    // If backend customer not available (dev mode), fall back to local auth user
    if (!customer) {
      const local = auth.getUser && auth.getUser();
      if (local) {
        customer = {
          fullName: local.fullName || `${local.firstName || ''} ${local.lastName || ''}`.trim(),
          email: local.email || '',
          firstName: local.firstName,
          lastName: local.lastName,
          title: (local.title || '').trim() || undefined,
        };
      } else {
        return;
      }
    }

    // Fill the dynamic profile info card if present
    function updateProfileInfoCard(customer) {
      if (!customer) return;
      const name = customer.fullName || customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`;
      const email = customer.email || customer.subjectRef || '';
      const city = customer.addressCity || customer.city || '';
      const country = customer.country || '';
      const role = customer.role || 'Member';
      const score = typeof customer.average === 'number' ? Math.round(customer.average * 20) : '–';
      // Avatar initials
      let initials = 'P';
      if (name && name.trim()) {
        initials = name.trim().split(/\s+/).slice(0,2).map(n=>n[0].toUpperCase()).join('');
      } else if (email) {
        initials = email[0].toUpperCase();
      }
      const avatar = document.getElementById('profile-info-avatar');
      if (avatar) { avatar.textContent = initials; }
      const nameEl = document.getElementById('profile-info-name');
      if (nameEl) { nameEl.textContent = name || '–'; }
      const roleEl = document.getElementById('profile-info-role');
      if (roleEl) { roleEl.textContent = role; }
      const locEl = document.getElementById('profile-info-location');
      if (locEl) { locEl.textContent = [city, country].filter(Boolean).join(', ') || '–'; }
      const scoreEl = document.getElementById('profile-info-score');
      if (scoreEl) { scoreEl.textContent = score; }
    }

    // Fill the trust profile card with dynamic data
    function updateTrustProfileCard(customer, engagement, testimonials) {
      if (!customer) return;
      // Basic info
      const name = customer.fullName || customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`;
      const email = customer.email || customer.subjectRef || '';
      const city = customer.addressCity || customer.city || '';
      const country = customer.country || '';
      const title = customer.title || customer.role || 'Member';
      const location = [city, country].filter(Boolean).join(', ');
      const score = typeof customer.average === 'number' ? Math.round(customer.average * 20) : '–';
      // Avatar/photo
      const photoEl = document.getElementById('profile-photo');
      if (photoEl) {
        const key = (customer.email ? 'peerRateAvatar:' + customer.email.toLowerCase() : null);
        const avatarUrl = key ? localStorage.getItem(key) : null;
        if (avatarUrl) {
          photoEl.src = avatarUrl;
        } else {
          photoEl.src = 'https://randomuser.me/api/portraits/lego/1.jpg'; // fallback
        }
      }
      const nameEl = document.getElementById('profile-fullname');
      if (nameEl) nameEl.textContent = name || '–';
      const titleEl = document.getElementById('profile-title');
      if (titleEl) titleEl.textContent = title;
      const locEl = document.getElementById('profile-location');
      if (locEl) locEl.textContent = location || '–';
      const scoreEl = document.getElementById('profile-score-big');
      if (scoreEl) scoreEl.textContent = score;
      // Feedback (demo: static or from engagement)
      document.getElementById('feedback-client').textContent = (engagement && engagement.clientFeedback) || 'Excellent';
      document.getElementById('feedback-leadership').textContent = (engagement && engagement.leadership) || 'Strong';
      document.getElementById('feedback-consistency').textContent = (engagement && engagement.consistency) || 'Recent & Stable';
      document.getElementById('verification-level').textContent = (engagement && engagement.verificationLevel) || 'High';
      // Engagement
      document.getElementById('engagement-title').textContent = (engagement && engagement.title) || 'Large Bank';
      document.getElementById('engagement-industry').textContent = '| ' + ((engagement && engagement.industry) || 'Finance');
      document.getElementById('engagement-role').textContent = (engagement && engagement.role) || title;
      document.getElementById('engagement-skills').innerHTML = (engagement && engagement.skills) || 'Project Management, Risk & Compliance, <b>Data Analytics</b>';
      document.getElementById('engagement-desc').textContent = (engagement && engagement.description) || 'Led implementation of new compliance system for a major bank. Managed a team of 8 consultants.';
      // Testimonials
      document.getElementById('testimonial-client').textContent = (testimonials && testimonials.client && testimonials.client.text) || '“Anna delivered excellent results on time.”';
      document.getElementById('testimonial-client-author').textContent = (testimonials && testimonials.client && testimonials.client.author) || 'Magnus S.';
      document.getElementById('testimonial-client-role').textContent = (testimonials && testimonials.client && testimonials.client.role) || 'Risk Director';
      document.getElementById('testimonial-manager').textContent = (testimonials && testimonials.manager && testimonials.manager.text) || '“Great leader with strong strategic focus.”';
      document.getElementById('testimonial-manager-author').textContent = (testimonials && testimonials.manager && testimonials.manager.author) || 'Elin L.';
      document.getElementById('testimonial-manager-role').textContent = (testimonials && testimonials.manager && testimonials.manager.role) || 'Consulting Director';
      document.getElementById('testimonial-team').textContent = (testimonials && testimonials.team && testimonials.team.text) || '“Anna is a fantastic team lead!”';
      document.getElementById('testimonial-team-author').textContent = (testimonials && testimonials.team && testimonials.team.author) || 'Erik J.';
      document.getElementById('testimonial-team-role').textContent = (testimonials && testimonials.team && testimonials.team.role) || 'Data Analyst';
    }

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
    // Update the info card
    updateProfileInfoCard(customer);
    // Update the trust profile card (demo: static engagement/testimonials)
    updateTrustProfileCard(customer, null, null);
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
    initRatingForm();   // binder betygsformuläret om det finns på sidan
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
          initQuestionnaire(),
          initInviteForm(),
        ]);
        // Prefill consultant name into the invite form when profile data is available
        try {
          const profileNameEl = document.getElementById('profile-fullname');
          const invName = document.getElementById('inv-consultant-name');
          const invTitle = document.getElementById('inv-consultant-title');
          const invCompany = document.getElementById('inv-company');
          const profileRootEl = document.getElementById('profile-root');
          if (profileRootEl && !profileRootEl.classList.contains('hidden')) {
            const name = profileNameEl && profileNameEl.textContent ? profileNameEl.textContent.trim() : '';
            if (name && invName && !invName.value) invName.value = name;
            // optional: try to fill title/company if available in DOM
            const titleText = document.getElementById('profile-title')?.textContent?.trim();
            if (titleText && invTitle && !invTitle.value) invTitle.value = titleText;
            const engagementCompany = document.getElementById('engagement-title')?.textContent?.trim();
            if (engagementCompany && invCompany && !invCompany.value) invCompany.value = engagementCompany;
          }
        } catch (err) {
          console.debug('invite prefill error', err);
        }
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
