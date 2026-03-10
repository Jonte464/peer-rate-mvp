// frontend/modules/ratingForm.js
import { showNotification } from './utils.js';
import auth, { login } from './auth.js';
import api from './api.js';
import { t } from './landing/language.js';

import {
  captureFromUrl,
  getPending,
  clearPending,
  markDealRated,
  isDealRated,
} from './pendingStore.js';

import { applyPendingContextCard, renderVerifiedDealUI } from './verifiedDealUI.js';
import {
  ensureLockedFormCard,
  removeLockedFormCard,
  sanitizeCounterparty,
  isDuplicateRatingError
} from './lockedRatingCard.js';

// ✅ Backwards compat exports (some older code may import these from ratingForm.js)
export { initPlatformPicker, initPlatformStarter } from './platformPicker.js';

function isRatePage() {
  return (window.location.pathname || '').toLowerCase().includes('/rate.html');
}

function getLoginCardEls() {
  return [
    document.getElementById('login-card'),
    document.getElementById('rating-login-card'),
    document.getElementById('rating-login'),
    document.querySelector('[data-role="rating-login"]'),
  ].filter(Boolean);
}

function getRatingWrapperEls() {
  return [
    document.getElementById('rating-form-wrapper'),
    document.getElementById('rating-card'),
    document.getElementById('rating-form-card'),
    document.getElementById('rating-form'),
  ].filter(Boolean);
}

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

  const localizedNeedle = t('rate_test_without_login', 'test utan inloggning').toLowerCase();
  const btns = Array.from(document.querySelectorAll('button, a'));
  const hit = btns.find(el => (el.textContent || '').toLowerCase().includes(localizedNeedle));
  if (hit) {
    hit.style.display = 'none';
    hit.setAttribute('aria-hidden', 'true');
  }
}

function setVisibility(isLoggedIn) {
  const loginCards = getLoginCardEls();
  const ratingWrappers = getRatingWrapperEls();

  const hint =
    document.getElementById('rating-login-hint') ||
    document.getElementById('ratingHint') ||
    null;

  const hasLoginTargets = loginCards.length > 0;
  const hasRatingTargets = ratingWrappers.length > 0;

  if (!hasLoginTargets && !hasRatingTargets) {
    console.warn('[PeerRate] setVisibility: no targets found; skipping toggle to avoid blank UI.');
    return;
  }

  const shouldShowLogin = !isLoggedIn || (!hasRatingTargets && isLoggedIn);
  const shouldShowRating = isLoggedIn && hasRatingTargets;

  if (hasLoginTargets) {
    loginCards.forEach((el) => {
      el.style.display = shouldShowLogin ? 'block' : 'none';
      el.classList.toggle('hidden', !shouldShowLogin);
    });
  }

  if (hint) {
    hint.classList.toggle('hidden', isLoggedIn);
    hint.style.display = isLoggedIn ? 'none' : '';
  }

  if (hasRatingTargets) {
    ratingWrappers.forEach((el) => {
      el.style.display = shouldShowRating ? 'block' : 'none';
      el.classList.toggle('hidden', !shouldShowRating);
    });
  }
}

function renderAll() {
  const p = getPending();

  // ✅ Om pending redan är markerad som rated lokalt → rensa direkt så UI inte spökar
  if (p && isDealRated(p)) {
    clearPending();
    renderVerifiedDealUI(null);
    removeLockedFormCard();
    return;
  }

  if (p) applyPendingContextCard(p);
  renderVerifiedDealUI(p);

  const u = auth.getUser?.() || null;
  setVisibility(!!u);

  if (p && u) {
    ensureLockedFormCard(p, u);
  } else {
    removeLockedFormCard();
  }
}

/**
 * initRatingLogin = login + pending + render verifierad affär + locked card
 */
export function initRatingLogin() {
  hideTestWithoutLoginButton();

  // capture pr= from URL if present
  const fromUrl = captureFromUrl();
  const pending = fromUrl || getPending();

  // ✅ Om den dealen redan är rated lokalt → rensa och visa inget pending
  if (pending && isDealRated(pending)) {
    clearPending();
    renderVerifiedDealUI(null);
  } else if (pending) {
    applyPendingContextCard(pending);
    renderVerifiedDealUI(pending);
  } else {
    renderVerifiedDealUI(null);
  }

  const loginForm = document.getElementById('rating-login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  renderAll();

  // bind events only once
  if (!window.__prPendingEventsBound) {
    window.__prPendingEventsBound = true;

    window.addEventListener('pr:pending-updated', () => {
      try { renderAll(); } catch {}
    });

    window.addEventListener('pr:pending-cleared', () => {
      try { renderAll(); } catch {}
    });
  }

  window.addEventListener('storage', () => {
    try { renderAll(); } catch {}
  });
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;

  const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
  const password = form.querySelector('input[name="password"]')?.value || '';

  if (!email || !password) {
    showNotification('error', t('profile_login_error_missing_fields', 'Fyll i både e-post och lösenord.'), 'login-status');
    return;
  }

  try {
    const res = await login(email, password);
    if (!res || res.ok === false) {
      showNotification('error', res?.error || t('profile_login_error_failed', 'Login failed.'), 'login-status');
      return;
    }

    showNotification('success', t('profile_login_success', 'Du är nu inloggad.'), 'login-status');

    if (isRatePage()) {
      renderAll();
      return;
    }

    window.setTimeout(() => {
      window.location.href = '/profile.html';
    }, 150);

  } catch (err) {
    console.error('login error', err);
    showNotification('error', t('profile_login_error_technical', 'Tekniskt fel vid inloggning.'), 'login-status');
  }
}

/**
 * Legacy open rating form (om andra sidor använder den)
 */
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
    showNotification('error', t('rate_error_required_fields', 'Fyll i alla obligatoriska fält innan du skickar.'), 'notice');
    return;
  }

  const pending = getPending();
  const rawCounterparty = pending?.counterparty || null;
  const deal = pending?.deal || null;
  const counterparty = sanitizeCounterparty(rawCounterparty, deal);

  const raterVal = form.querySelector('input[name="rater"]')?.value?.trim() || null;

  const payload = {
    subject: subjectEmail,
    rating: Number(score),
    rater: raterVal || undefined,
    comment: comment || undefined,
    proofRef: proofRef || undefined,
    source: sourceRaw || undefined,
    counterparty: counterparty || undefined,
    deal: deal || undefined,
  };

  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const result = await api.createRating(payload);
    if (!result || result.ok === false) {
      // ✅ Duplicate: markera som rated + rensa pending så overlay inte hänger kvar
      if (isDuplicateRatingError(result)) {
        try { markDealRated(pending || { source: sourceRaw, proofRef }); } catch {}
        clearPending();
        showNotification('error', t('rate_error_duplicate', 'Omdöme har redan lämnats för denna affär.'), 'notice');
      } else {
        showNotification('error', result?.error || t('rate_error_save', 'Kunde inte spara betyget.'), 'notice');
      }

      if (btn) btn.disabled = false;
      return;
    }

    // ✅ Success: markera rated + rensa pending
    try { markDealRated(pending || { source: sourceRaw, proofRef }); } catch {}
    clearPending();

    showNotification('success', t('rate_success_saved_toast', 'Tack! Ditt omdöme är sparat.'), 'notice');
    form.reset();
    if (btn) btn.disabled = false;
  } catch (err) {
    console.error('submit error', err);
    showNotification('error', t('rate_error_technical', 'Tekniskt fel. Försök igen om en stund.'), 'notice');
    if (btn) btn.disabled = false;
  }
}