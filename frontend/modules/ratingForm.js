// frontend/modules/ratingForm.js
import { showNotification } from './utils.js';
import auth, { login } from './auth.js';
import api from './api.js';

const PENDING_KEY = 'peerrate_pending_rating_v2';
const TTL_MS = 1000 * 60 * 60 * 24;

function now() { return Date.now(); }

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function readB64Json(b64) {
  try {
    const cleaned = decodeURIComponent(b64);
    return safeParse(atob(cleaned));
  } catch {
    return null;
  }
}

function setPending(data) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...data, _ts: now() }));
  } catch {}
}

function getPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!parsed) return null;
    if (now() - (parsed._ts || 0) > TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

function isRatePage() {
  return (window.location.pathname || '').toLowerCase().includes('/rate.html');
}

/**
 * Visar/döljer login + rating-form på rate.html
 * Förutsätter att du har:
 * - #login-card
 * - #rating-form-wrapper
 * - #rating-login-hint (valfritt)
 */
function setVisibility(isLoggedIn) {
  const loginCard = document.getElementById('login-card');
  const ratingWrapper = document.getElementById('rating-form-wrapper');
  const hint = document.getElementById('rating-login-hint');

  if (isLoggedIn) {
    if (ratingWrapper) ratingWrapper.classList.remove('hidden');
    if (hint) hint.classList.add('hidden');
    if (loginCard) loginCard.classList.add('hidden');
  } else {
    if (ratingWrapper) ratingWrapper.classList.add('hidden');
    if (hint) hint.classList.remove('hidden');
    if (loginCard) loginCard.classList.remove('hidden');
  }
}

function applyPendingToUI(p) {
  if (!p) return;

  // Context-card
  const ctxCard = document.getElementById('rate-context-card');
  const ctxSource = document.getElementById('rate-context-source');
  const ctxLink = document.getElementById('rate-context-link');

  if (ctxCard) ctxCard.style.display = '';
  if (ctxSource) ctxSource.textContent = (p.source || '–');
  if (ctxLink && p.pageUrl) {
    ctxLink.href = p.pageUrl;
    ctxLink.style.display = '';
  }

  // Form
  const form = document.getElementById('rating-form');
  if (!form) return;

  // Subject = email (HÅRD)
  const subjectInput = form.querySelector('input[name="ratedUserEmail"]');
  const email = p.subjectEmail || p?.counterparty?.email || null;
  if (subjectInput && email) {
    subjectInput.value = email;
    subjectInput.readOnly = true;
    subjectInput.style.background = '#f7f8fb';
  }

  // Source (låst om vi vet)
  const sourceSelect = form.querySelector('select[name="source"]');
  if (sourceSelect && p.source) {
    const v = String(p.source).toLowerCase().includes('tradera') ? 'Tradera' : p.source;
    sourceSelect.value = v;
    sourceSelect.disabled = true;
  }

  // proofRef (ordernr)
  const proof = form.querySelector('input[name="proofRef"]');
  if (proof && (p.proofRef || p?.counterparty?.orderId)) {
    proof.value = p.proofRef || p.counterparty.orderId;
  }
}

function captureFromUrl() {
  const qs = new URLSearchParams(window.location.search || '');
  const pr = qs.get('pr');
  const source = qs.get('source') || '';
  const pageUrl = qs.get('pageUrl') || '';

  if (!pr && !source && !pageUrl) return null;

  if (pr) {
    const decoded = readB64Json(pr);
    if (decoded && typeof decoded === 'object') {
      if (!decoded.source && source) decoded.source = source;
      if (!decoded.pageUrl && pageUrl) decoded.pageUrl = pageUrl;
      setPending(decoded);
      return decoded;
    }
  }

  // fallback (om gamla länkar)
  const existing = getPending();
  if (!existing) {
    setPending({ source: source || undefined, pageUrl: pageUrl || undefined });
    return getPending();
  }
  return existing;
}

export function initRatingLogin() {
  // ✅ Se till att rating-kortet kan visas (inte låst till display:none från HTML)
  const ratingCard = document.getElementById('rating-card');
  if (ratingCard) ratingCard.style.display = 'block';

  // 1) fånga pending från URL
  const fromUrl = captureFromUrl();
  const pending = fromUrl || getPending();
  if (pending) applyPendingToUI(pending);

  // 2) bind login
  const loginForm = document.getElementById('rating-login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  // 3) sätt UI-läge direkt baserat på session
  const user = auth.getUser?.() || null;
  setVisibility(!!user);

  if (user) {
    initRatingForm();

    // Lås rater = user email
    const raterInput =
      document.querySelector('#rating-form input[name="rater"]') ||
      document.getElementById('rater');

    if (raterInput && user.email) {
      raterInput.value = user.email;
      raterInput.readOnly = true;
      raterInput.style.background = '#f7f8fb';
    }

    const p = getPending();
    if (p) applyPendingToUI(p);
  }

  // ✅ om login/logout sker i annan flik, uppdatera UI
  window.addEventListener('storage', () => {
    const u2 = auth.getUser?.() || null;
    setVisibility(!!u2);
    if (u2) {
      try { initRatingForm(); } catch {}
      const p = getPending();
      if (p) applyPendingToUI(p);
    }
  });
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;

  const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
  const password = form.querySelector('input[name="password"]')?.value || '';

  if (!email || !password) {
    showNotification('error', 'Fyll i både e-post och lösenord.', 'login-status');
    return;
  }

  try {
    const res = await login(email, password);
    if (!res || res.ok === false) {
      showNotification('error', res?.error || 'Login failed.', 'login-status');
      return;
    }

    showNotification('success', 'Du är nu inloggad.', 'login-status');

    // Om vi är på rate.html: stanna kvar och visa formuläret
    if (isRatePage()) {
      setVisibility(true);
      initRatingForm();

      const user = auth.getUser?.() || null;
      const raterInput =
        document.querySelector('#rating-form input[name="rater"]') ||
        document.getElementById('rater');

      if (raterInput && user?.email) {
        raterInput.value = user.email;
        raterInput.readOnly = true;
        raterInput.style.background = '#f7f8fb';
      }

      const p = getPending();
      if (p) applyPendingToUI(p);

      return;
    }

    // På andra sidor: gå till profil
    window.setTimeout(() => {
      window.location.href = '/profile.html';
    }, 150);

  } catch (err) {
    console.error('login error', err);
    showNotification('error', 'Tekniskt fel vid inloggning.', 'login-status');
  }
}

export function initRatingForm() {
  const form = document.getElementById('rating-form');
  if (!form) return;

  if (form.dataset.ratingBound === '1') return;
  form.dataset.ratingBound = '1';

  form.addEventListener('submit', handleSubmit);

  const resetBtn = document.getElementById('reset-form');
  if (resetBtn) resetBtn.addEventListener('click', () => form.reset());
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;

  const subjectEmail = form.querySelector('input[name="ratedUserEmail"]')?.value?.trim() || '';
  const score = Number(form.querySelector('select[name="score"]')?.value || 0);
  const comment = form.querySelector('textarea[name="comment"]')?.value?.trim() || '';
  const proofRef = form.querySelector('input[name="proofRef"]')?.value?.trim() || '';
  const sourceRaw = form.querySelector('select[name="source"]')?.value || '';

  if (!subjectEmail || !score) {
    showNotification('error', 'Fyll i alla obligatoriska fält innan du skickar.', 'notice');
    return;
  }

  // Hämta pending payload och skicka med som “kundakt-underlag”
  const pending = getPending();
  const counterparty = pending?.counterparty || null;

  // rater = inloggad email (låst)
  const raterVal = form.querySelector('input[name="rater"]')?.value?.trim() || null;

  const payload = {
    subject: subjectEmail,
    rating: Number(score),
    rater: raterVal || undefined,
    comment: comment || undefined,
    proofRef: proofRef || undefined,
    source: sourceRaw || undefined,
    counterparty: counterparty || undefined,
  };

  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const result = await api.createRating(payload);
    if (!result || result.ok === false) {
      showNotification('error', result?.error || 'Kunde inte spara betyget.', 'notice');
      if (btn) btn.disabled = false;
      return;
    }

    clearPending();
    showNotification('success', 'Tack för ditt omdöme!', 'notice');
    form.reset();
    if (btn) btn.disabled = false;
  } catch (err) {
    console.error('submit error', err);
    showNotification('error', 'Tekniskt fel. Försök igen om en stund.', 'notice');
    if (btn) btn.disabled = false;
  }
}
