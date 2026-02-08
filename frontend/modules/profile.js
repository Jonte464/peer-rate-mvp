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

/* Reusable Rotator helper
 - usage: createRotator({container, items, render(item), intervalMs})
 - returns an object with start(), stop(), next(), prev(), destroy()
 - respects `prefers-reduced-motion` (disables auto-rotation)
 - pauses on hover and cleans up intervals to avoid leaks
 */
function createRotator({
  container,
  items = [],
  render,
  intervalMs = 5000,
  animation = 'fade', // currently only 'fade' used
  pauseOnHover = true,
  showControls = false,
} = {}) {
  if (!container || typeof render !== 'function') return null;

  // allow multiple rotators attached to page; store on element
  const rotatorKey = '__pr_rotator';
  if (container[rotatorKey]) {
    try { container[rotatorKey].destroy(); } catch (e) {}
  }

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let idx = 0;
  let timer = null;
  let running = false;

  const safeItems = Array.isArray(items) ? items.slice() : [];

  const setOpacity = (el, v) => { if (!el) return; el.style.transition = 'opacity .35s ease'; el.style.opacity = String(v); };

  function showIndex(i) {
    const item = safeItems.length ? safeItems[i] : null;
    if (animation === 'fade' && container) {
      try {
        setOpacity(container, 0);
        setTimeout(() => {
          try { render(item, i); } catch (err) { console.debug('rotator render error', err); }
          setOpacity(container, 1);
        }, 250);
      } catch (err) {
        try { render(item, i); } catch (err2) { console.debug('rotator render error', err2); }
      }
    } else {
      try { render(item, i); } catch (err) { console.debug('rotator render error', err); }
    }
  }

  function next() {
    if (!safeItems.length) return;
    idx = (idx + 1) % safeItems.length;
    showIndex(idx);
  }

  function prev() {
    if (!safeItems.length) return;
    idx = (idx - 1 + safeItems.length) % safeItems.length;
    showIndex(idx);
  }

  function start() {
    if (running) return;
    running = true;
    if (prefersReduced) return;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (!document.body.contains(container)) { stop(); return; }
      next();
    }, intervalMs);
    console.debug('pr rotator started', container.id || container.className || container.tagName);
  }

  function stop() {
    running = false;
    if (timer) { clearInterval(timer); timer = null; }
    console.debug('pr rotator stopped', container.id || container.className || container.tagName);
  }

  function destroy() {
    stop();
    try {
      if (pauseOnHover) {
        container.removeEventListener('mouseenter', stopHandler);
        container.removeEventListener('mouseleave', startHandler);
      }
      const controls = container.querySelector('.pr-rotator-controls');
      if (controls && controls.parentNode) controls.parentNode.removeChild(controls);
    } catch (err) { /* ignore */ }
    delete container[rotatorKey];
  }

  function stopHandler() { stop(); }
  function startHandler() { start(); }

  if (pauseOnHover) {
    container.addEventListener('mouseenter', stopHandler);
    container.addEventListener('mouseleave', startHandler);
  }

  if (showControls) {
    const ctrl = document.createElement('div');
    ctrl.className = 'pr-rotator-controls';
    ctrl.style.cssText = 'display:flex;gap:6px;position:absolute;right:8px;top:8px;z-index:3';
    const prevBtn = document.createElement('button');
    prevBtn.setAttribute('aria-label','Previous'); prevBtn.textContent = '◀'; prevBtn.style.cssText = 'background:transparent;border:none;font-size:14px;cursor:pointer';
    const nextBtn = document.createElement('button');
    nextBtn.setAttribute('aria-label','Next'); nextBtn.textContent = '▶'; nextBtn.style.cssText = 'background:transparent;border:none;font-size:14px;cursor:pointer';
    prevBtn.addEventListener('click',(e)=>{ e.preventDefault(); prev(); });
    nextBtn.addEventListener('click',(e)=>{ e.preventDefault(); next(); });
    ctrl.appendChild(prevBtn); ctrl.appendChild(nextBtn);
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(ctrl);
  }

  container[rotatorKey] = { start, stop, next, prev, destroy };
  // initial render using showIndex so animation applies
  showIndex(idx);
  if (safeItems.length > 1 && !prefersReduced) start();

  return container[rotatorKey];
}

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
  applyAvatar(el('menu-profile-avatar'));
}

// Populate the small 'My details' menu dropdown with basic user info (used by menu)
export function populateMenuProfile() {
  try {
    const user = auth.getUser && auth.getUser();
    if (!user) return;
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value === undefined || value === null || value === '' ? '-' : String(value);
    };

    const name = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    set('menu-profile-name', name || '-');
    set('menu-profile-email', user.email || '-');
    set('menu-profile-phone', user.phone || '-');
    set('menu-profile-city', user.addressCity || user.city || '-');
    // ensure avatars updated
    updateAvatars(user);
  } catch (err) {
    console.debug('populateMenuProfile error', err);
  }
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
    // `engagements` can be a single engagement object or an array of engagements.
    function updateTrustProfileCard(customer, engagements, testimonials) {
      if (!customer) return;
      // Normalize to array if a single object provided
      const engagementList = Array.isArray(engagements)
        ? engagements
        : engagements
        ? [engagements]
        : [];
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
      // Engagement(s) — support an array carousel
      const engagementCard = document.getElementById('recent-engagement-card');
      const renderEngagement = (eng) => {
        if (!eng) {
          document.getElementById('engagement-title').textContent = 'Large Bank';
          document.getElementById('engagement-industry').textContent = '| Finance';
          document.getElementById('engagement-role').textContent = title;
          document.getElementById('engagement-skills').innerHTML = 'Project Management, Risk & Compliance, <b>Data Analytics</b>';
          document.getElementById('engagement-desc').textContent = 'Led implementation of new compliance system for a major bank. Managed a team of 8 consultants.';
          return;
        }
        document.getElementById('engagement-title').textContent = eng.title || '—';
        document.getElementById('engagement-industry').textContent = eng.industry ? ('| ' + eng.industry) : '';
        document.getElementById('engagement-role').textContent = eng.role || title;
        document.getElementById('engagement-skills').innerHTML = eng.skills || '';
        document.getElementById('engagement-desc').textContent = eng.description || '';
      };

      // Carousel: use reusable rotator helper (5s default, fade)
      try {
        // engagementList is already normalized above
        const engagementContainer = engagementCard || document.getElementById('recent-engagement-card');
        createRotator({
          container: engagementContainer,
          items: engagementList,
          intervalMs: 5000,
          animation: 'fade',
          pauseOnHover: true,
          showControls: false,
          render: (item) => {
            // fade handled by CSS transitions on container; render content synchronously
            renderEngagement(item);
          },
        });
      } catch (err) {
        console.debug('engagement rotator error', err);
      }
      // Testimonials
      // Testimonials: support rotating arrays per box (client, manager, team)
      try {
        const buildList = (nodeOrVal) => {
          if (!nodeOrVal) return [];
          if (Array.isArray(nodeOrVal)) return nodeOrVal.slice();
          // object with fields
          if (typeof nodeOrVal === 'object' && (nodeOrVal.text || nodeOrVal.author || nodeOrVal.role)) {
            return [{ text: nodeOrVal.text || '', author: nodeOrVal.author || '', role: nodeOrVal.role || '' }];
          }
          return [];
        };

        const clientList = buildList(testimonials && testimonials.client) ;
        const managerList = buildList(testimonials && testimonials.manager) ;
        const teamList = buildList(testimonials && testimonials.team) ;

        // If no lists provided, fall back to single default items (keeps old behaviour)
        if (!clientList.length) clientList.push({ text: '“Anna delivered excellent results on time.”', author: 'Magnus S.', role: 'Risk Director' });
        if (!managerList.length) managerList.push({ text: '“Great leader with strong strategic focus.”', author: 'Elin L.', role: 'Consulting Director' });
        if (!teamList.length) teamList.push({ text: '“Anna is a fantastic team lead!”', author: 'Erik J.', role: 'Data Analyst' });

        // render helpers
        const renderClient = (item) => {
          const text = item ? item.text || '' : '';
          document.getElementById('testimonial-client').textContent = text;
          document.getElementById('testimonial-client-author').textContent = item && item.author ? item.author : '';
          document.getElementById('testimonial-client-role').textContent = item && item.role ? item.role : '';
        };
        const renderManager = (item) => {
          document.getElementById('testimonial-manager').textContent = item ? item.text || '' : '';
          document.getElementById('testimonial-manager-author').textContent = item && item.author ? item.author : '';
          document.getElementById('testimonial-manager-role').textContent = item && item.role ? item.role : '';
        };
        const renderTeam = (item) => {
          document.getElementById('testimonial-team').textContent = item ? item.text || '' : '';
          document.getElementById('testimonial-team-author').textContent = item && item.author ? item.author : '';
          document.getElementById('testimonial-team-role').textContent = item && item.role ? item.role : '';
        };

        // Attach rotators to each box container (parent node of the content)
        const clientContainer = document.getElementById('testimonial-client')?.closest('div');
        const managerContainer = document.getElementById('testimonial-manager')?.closest('div');
        const teamContainer = document.getElementById('testimonial-team')?.closest('div');

        if (clientContainer) createRotator({ container: clientContainer, items: clientList, render: renderClient, intervalMs: 5000, pauseOnHover: true });
        if (managerContainer) createRotator({ container: managerContainer, items: managerList, render: renderManager, intervalMs: 5000, pauseOnHover: true });
        if (teamContainer) createRotator({ container: teamContainer, items: teamList, render: renderTeam, intervalMs: 5000, pauseOnHover: true });
      } catch (err) {
        console.debug('testimonial rotator error', err);
      }
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
    // Also populate the menu dropdown variants if present
    set('menu-profile-name', customer.fullName || customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`);
    set('menu-profile-email', customer.email || customer.subjectRef || '-');
    set('menu-profile-phone', customer.phone || '-');
    set('menu-profile-city', customer.addressCity || customer.city || '-');
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
    // If backend provides `engagements` on the customer, pass them; otherwise null
    updateTrustProfileCard(customer, customer.engagements || null, null);
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

  // Delete account button (in My Details page)
  try {
    const deleteBtn = document.getElementById('delete-account-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const ok = window.confirm('Are you sure you want to delete your account? This will remove local data and may not delete server-side data on this development instance.');
        if (!ok) return;
        try {
          // Try best-effort server delete if endpoint exists
          let serverHandled = false;
          try {
            const resp = await fetch('/api/customers/me', { method: 'DELETE', credentials: 'include' });
            if (resp && (resp.ok || resp.status === 204)) {
              serverHandled = true;
            }
          } catch (err) {
            // ignore network errors
          }

          // Clear local artifacts: avatar and peerRateUser cookie/localStorage keys
          try {
            const user = auth.getUser && auth.getUser();
            if (user && user.email) {
              const key = 'peerRateAvatar:' + String(user.email).toLowerCase();
              localStorage.removeItem(key);
            }
            localStorage.removeItem('peerRateUser');
            localStorage.removeItem('peerRateAdminKey');
            // remove any test avatars too
            Object.keys(localStorage).forEach(k => { if (k && k.toString().startsWith('peerRateAvatar:')) localStorage.removeItem(k); });
            // try to remove cookie by setting expiry (best-effort)
            document.cookie = 'peerRateUser=; Max-Age=0; path=/';
          } catch (err) {
            console.debug('delete local data error', err);
          }

          if (serverHandled) {
            showNotification('success', 'Your account was deleted. You will be signed out.');
          } else {
            showNotification('info', 'Local data cleared. Server-side deletion may not be available on this instance.');
          }
          // Logout and reload to reflect state
          try { await logout(); } catch (err) { /* ignore */ }
          window.setTimeout(() => { window.location.href = '/'; }, 600);
        } catch (err) {
          console.error('delete account error', err);
          showNotification('error', 'Could not delete account.');
        }
      });
    }
  } catch (err) {
    console.debug('delete account bind error', err);
  }

  // Edit / Save profile fields (My Details page)
  try {
    const editBtn = document.getElementById('edit-profile-btn');
    const profileList = document.querySelector('.profile-list');
    if (editBtn && profileList) {
      let editing = false;

      const fieldIds = [
        { id: 'profile-name', key: 'fullName' },
        { id: 'profile-email', key: 'email' },
        { id: 'profile-phone', key: 'phone' },
        { id: 'profile-addressStreet', key: 'addressStreet' },
        { id: 'profile-addressZip', key: 'addressZip' },
        { id: 'profile-addressCity', key: 'addressCity' },
        { id: 'profile-country', key: 'country' },
      ];

      function toInput(span) {
        const val = span.textContent === '–' ? '' : span.textContent;
        const input = document.createElement('input');
        // preserve the original id so save logic can find the input by id
        if (span.id) input.id = span.id;
        input.type = 'text';
        input.className = 'profile-edit-input';
        input.value = val;
        input.style.cssText = 'width:100%;padding:6px;border-radius:6px;border:1px solid #e5e7eb;background:rgba(255,255,255,0.04);color:inherit;';

        // Make zip and phone numeric-friendly: inputMode + simple sanitization
        if (span.id === 'profile-addressZip') {
          input.inputMode = 'numeric';
          input.pattern = '[0-9]*';
          input.addEventListener('input', () => {
            // remove non-digits
            const cleaned = input.value.replace(/\D+/g, '');
            if (cleaned !== input.value) input.value = cleaned;
          });
        }

        if (span.id === 'profile-phone') {
          input.inputMode = 'numeric';
          input.pattern = '[0-9]*';
          input.addEventListener('input', () => {
            // allow only digits for phone in this instance
            const cleaned = input.value.replace(/\D+/g, '');
            if (cleaned !== input.value) input.value = cleaned;
          });
        }

        return input;
      }

      function enterEdit() {
        editing = true;
        editBtn.textContent = 'Save';
        fieldIds.forEach(f => {
          const span = document.getElementById(f.id);
          if (!span) return;
          const input = toInput(span);
          span.parentNode.replaceChild(input, span);
        });
      }

      async function saveEdit() {
        // gather values
        const payload = {};
        fieldIds.forEach(f => {
          const input = document.getElementById(f.id) || document.querySelector(`#${f.id}.profile-edit-input`);
          if (input) payload[f.key] = input.value.trim();
        });

        // attempt server update (best-effort)
        let serverOk = false;
        try {
          const res = await fetch('/api/customers/me', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res && res.ok) serverOk = true;
        } catch (err) {
          console.debug('profile save server error', err);
        }

        // fallback: save locally
        try {
          const draftKey = 'peerRateProfileDraft';
          localStorage.setItem(draftKey, JSON.stringify(payload));
        } catch (err) { /* ignore */ }

        // replace inputs back with spans showing current values
        fieldIds.forEach(f => {
          const node = document.getElementById(f.id);
          let value = '';
          if (node && node.tagName === 'INPUT') value = node.value.trim();
          else if (node) value = node.textContent || '';
          const span = document.createElement('span');
          span.className = 'profile-value';
          span.id = f.id;
          span.textContent = value || '–';
          if (node && node.parentNode) node.parentNode.replaceChild(span, node);
        });

        editing = false;
        editBtn.textContent = 'Edit';

        if (serverOk) showNotification('success', 'Profile saved.');
        else showNotification('info', 'Saved locally. Server update not available on this instance.');
      }

      editBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!editing) {
          enterEdit();
        } else {
          await saveEdit();
        }
      });
    }
  } catch (err) {
    console.debug('bind edit profile error', err);
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
