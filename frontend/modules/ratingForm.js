// frontend/modules/ratingForm.js
import { showNotification } from './utils.js';
import auth, { login } from './auth.js';
import api from './api.js';

const PENDING_KEY = 'peerrate_pending_rating_v2';
const TTL_MS = 1000 * 60 * 60 * 24;

function now() { return Date.now(); }
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

function readB64Json(b64) {
  try {
    const cleaned = decodeURIComponent(b64);
    return safeParse(atob(cleaned));
  } catch {
    return null;
  }
}

function setPending(data) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...data, _ts: now() })); } catch {}
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

/** Robust: hitta login-card även om id varierar */
function getLoginCardEls() {
  return [
    document.getElementById('login-card'),
    document.getElementById('rating-login-card'),
    document.getElementById('rating-login'),
    document.querySelector('[data-role="rating-login"]'),
  ].filter(Boolean);
}

/** Robust: hitta alla tänkbara wrappers för rating-form */
function getRatingWrapperEls() {
  return [
    document.getElementById('rating-form-wrapper'),
    document.getElementById('rating-card'),
    document.getElementById('rating-form-card'),
    document.getElementById('rating-form'),
  ].filter(Boolean);
}

/** Hitta (och dölj) “Test utan inloggning” om den finns */
function hideTestWithoutLoginButton() {
  const byId =
    document.getElementById('test-without-login') ||
    document.getElementById('test-without-login-btn') ||
    document.getElementById('testWithoutLogin') ||
    document.getElementById('testWithoutLoginBtn') ||
    document.getElementById('testWithoutLoginBtn2');

  if (byId) {
    byId.style.display = 'none';
    byId.setAttribute('aria-hidden', 'true');
    return;
  }

  const btns = Array.from(document.querySelectorAll('button, a'));
  const hit = btns.find(el => (el.textContent || '').toLowerCase().includes('test utan inloggning'));
  if (hit) {
    hit.style.display = 'none';
    hit.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Bulletproof show/hide:
 * - Om element saknas: visa hellre mer än mindre (aldrig "vit" sida)
 * - Inloggad: göm login, visa rating
 * - Utloggad: visa login, göm rating
 */
function setVisibility(isLoggedIn) {
  const loginCards = getLoginCardEls();
  const ratingWrappers = getRatingWrapperEls();

  const hint =
    document.getElementById('rating-login-hint') ||
    document.getElementById('ratingHint') ||
    null;

  const hasLoginTargets = loginCards.length > 0;
  const hasRatingTargets = ratingWrappers.length > 0;

  // Failsafe: om vi inte hittar något att toggla, gör inget (undvik vit sida).
  if (!hasLoginTargets && !hasRatingTargets) {
    console.warn('[PeerRate] setVisibility: no targets found; skipping toggle to avoid blank UI.');
    return;
  }

  // Om logged in men ratingWrappers saknas → visa login också (hellre dubbelt än tomt).
  const shouldShowLogin = !isLoggedIn || (!hasRatingTargets && isLoggedIn);
  const shouldShowRating = isLoggedIn && hasRatingTargets;

  // Login UI
  if (hasLoginTargets) {
    loginCards.forEach((el) => {
      el.style.display = shouldShowLogin ? 'block' : 'none';
      el.classList.toggle('hidden', !shouldShowLogin);
    });
  }

  // Hint (den sitter inne i rating-card i din HTML)
  if (hint) {
    hint.classList.toggle('hidden', isLoggedIn);
    hint.style.display = isLoggedIn ? 'none' : '';
  }

  // Rating UI
  if (hasRatingTargets) {
    ratingWrappers.forEach((el) => {
      el.style.display = shouldShowRating ? 'block' : 'none';
      el.classList.toggle('hidden', !shouldShowRating);
    });
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

  // Source (låst)
  const sourceSelect = form.querySelector('select[name="source"]');
  if (sourceSelect && p.source) {
    const v = String(p.source).toLowerCase().includes('tradera') ? 'Tradera' : p.source;
    sourceSelect.value = v;
    sourceSelect.disabled = true;
  }

  // proofRef
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

  const existing = getPending();
  if (!existing) {
    setPending({ source: source || undefined, pageUrl: pageUrl || undefined });
    return getPending();
  }
  return existing;
}

export function initRatingLogin() {
  hideTestWithoutLoginButton();

  // 1) pending från URL
  const fromUrl = captureFromUrl();
  const pending = fromUrl || getPending();
  if (pending) applyPendingToUI(pending);

  // 2) bind login
  const loginForm = document.getElementById('rating-login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  // 3) sätt UI direkt baserat på session
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

  // 4) om login/logout sker i annan flik
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

    // På rate.html: stanna, göm login, visa form
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

    // Annars: till profil
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

  const pending = getPending();
  const counterparty = pending?.counterparty || null;

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
