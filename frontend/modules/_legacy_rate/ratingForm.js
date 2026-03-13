// frontend/modules/ratingForm.js
import { showNotification } from '../utils.js';
import auth, { login } from '../auth.js';
import api from '../api.js';
import { t } from '../landing/language.js';

import {
  captureFromUrl,
  captureFromExtensionBridge,
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

export { initPlatformPicker, initPlatformStarter } from './platformPicker.js';

let activePending = null;
let bootstrapInFlight = false;

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

function hideLoginCard() {
  const els = getLoginCardEls();
  els.forEach((el) => {
    el.style.display = 'none';
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  });
}

function showLoginCardIfPresent() {
  const els = getLoginCardEls();
  els.forEach((el) => {
    el.style.display = 'block';
    el.classList.remove('hidden');
    el.removeAttribute('aria-hidden');
  });
}

function setLoginVisibility(isLoggedIn) {
  const hint =
    document.getElementById('rating-login-hint') ||
    document.getElementById('ratingHint') ||
    null;

  if (isLoggedIn) {
    hideLoginCard();
  } else {
    showLoginCardIfPresent();
  }

  if (hint) {
    hint.classList.toggle('hidden', isLoggedIn);
    hint.style.display = isLoggedIn ? 'none' : '';
  }
}

function hasPendingIdentity(p) {
  return !!(
    p?.proofRef ||
    p?.deal?.orderId ||
    p?.deal?.bookingId ||
    p?.deal?.transactionId ||
    p?.pageUrl
  );
}

function buildDealPayloadForExtension(pendingLike) {
  const p = pendingLike || {};
  return {
    source: p?.source || p?.deal?.platform || '',
    proofRef:
      p?.proofRef ||
      p?.deal?.orderId ||
      p?.counterparty?.orderId ||
      p?.pageUrl ||
      '',
    pageUrl: p?.pageUrl || p?.deal?.pageUrl || p?.counterparty?.pageUrl || '',
    deal: p?.deal || null,
    counterparty: p?.counterparty || null,
  };
}

function notifyExtensionDealRated(pendingLike) {
  try {
    const payload = buildDealPayloadForExtension(pendingLike);
    const proofRef = String(payload?.proofRef || '').trim();
    const source = String(payload?.source || '').trim();

    if (!proofRef || !source) return;

    window.postMessage(
      {
        type: 'PEERRATE_MARK_DEAL_RATED',
        payload,
      },
      window.location.origin
    );
  } catch (err) {
    console.warn('[PeerRate] notifyExtensionDealRated failed:', err);
  }
}

async function resolveAuthUser() {
  try {
    const user = await auth.getResolvedUser();
    return user || null;
  } catch (err) {
    console.warn('[PeerRate] resolveAuthUser failed:', err);
    return null;
  }
}

async function syncPendingStatusWithBackend() {
  const pending = activePending || getPending();
  if (!pending || !hasPendingIdentity(pending)) {
    return { ok: true, alreadyRated: false };
  }

  try {
    const status = await api.checkRatingDealStatus(pending);

    if (status?.ok && status.alreadyRated) {
      try { markDealRated(pending); } catch {}
      notifyExtensionDealRated(pending);
      activePending = null;
      clearPending();
      return status;
    }

    return status || { ok: false };
  } catch (err) {
    console.warn('[PeerRate] syncPendingStatusWithBackend failed:', err);
    return { ok: false };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capturePendingRobust() {
  const fromUrl = captureFromUrl();
  if (fromUrl) {
    activePending = fromUrl;
  }

  const stored = getPending();
  if (stored && !activePending) {
    activePending = stored;
  }

  if (isRatePage()) {
    const bridged = await captureFromExtensionBridge(1800);
    if (bridged) {
      activePending = bridged;
      return activePending;
    }

    await sleep(250);

    const bridgedRetry = await captureFromExtensionBridge(1400);
    if (bridgedRetry) {
      activePending = bridgedRetry;
      return activePending;
    }
  }

  return activePending || getPending() || null;
}

async function renderAll() {
  const p = activePending || getPending() || null;

  if (p && isDealRated(p)) {
    notifyExtensionDealRated(p);
    activePending = null;
    clearPending();
    renderVerifiedDealUI(null);
    removeLockedFormCard();
    return;
  }

  if (p) {
    applyPendingContextCard(p);
    renderVerifiedDealUI(p);
  } else {
    renderVerifiedDealUI(null);
  }

  const user = await resolveAuthUser();
  setLoginVisibility(!!user);

  if (p) {
    ensureLockedFormCard(p, user);
  } else {
    removeLockedFormCard();
  }
}

async function bootstrapPage() {
  if (bootstrapInFlight) return;
  bootstrapInFlight = true;

  try {
    await capturePendingRobust();

    const status = await syncPendingStatusWithBackend();
    if (status?.ok && status.alreadyRated) {
      try {
        showNotification(
          'success',
          t('rate_info_already_completed', 'Den här affären är redan betygsatt och har därför tagits bort från listan.'),
          'notice'
        );
      } catch {}
    }

    await renderAll();
  } finally {
    bootstrapInFlight = false;
  }
}

function scrollToRelevantTarget(isLoggedIn) {
  const target = isLoggedIn
    ? document.getElementById('locked-rating-card')
    : (
        document.getElementById('login-card') ||
        document.getElementById('rating-login-card') ||
        document.getElementById('rating-login-form')
      );

  if (target) {
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }
}

export function initRatingLogin() {
  hideTestWithoutLoginButton();

  const loginForm = document.getElementById('rating-login-form');
  if (loginForm && loginForm.dataset.bound !== '1') {
    loginForm.dataset.bound = '1';
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  if (!window.__prPendingEventsBound) {
    window.__prPendingEventsBound = true;

    window.addEventListener('pr:pending-updated', () => {
      const p = getPending();
      if (p) activePending = p;
      void renderAll();
    });

    window.addEventListener('pr:pending-cleared', () => {
      activePending = null;
      void renderAll();
    });
  }

  window.addEventListener('storage', () => {
    const p = getPending();
    if (p) activePending = p;
    void renderAll();
  });

  void bootstrapPage();

  if (isRatePage()) {
    setTimeout(() => { void bootstrapPage(); }, 700);
  }
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

    await renderAll();
    scrollToRelevantTarget(true);

  } catch (err) {
    console.error('login error', err);
    showNotification('error', t('profile_login_error_technical', 'Tekniskt fel vid inloggning.'), 'login-status');
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
    showNotification('error', t('rate_error_required_fields', 'Fyll i alla obligatoriska fält innan du skickar.'), 'notice');
    return;
  }

  const pending = activePending || getPending();
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
      if (isDuplicateRatingError(result)) {
        try { markDealRated(pending || { source: sourceRaw, proofRef }); } catch {}
        notifyExtensionDealRated(pending || { source: sourceRaw, proofRef });
        activePending = null;
        clearPending();
        showNotification('error', t('rate_error_duplicate', 'Omdöme har redan lämnats för denna affär.'), 'notice');
      } else {
        showNotification('error', result?.error || t('rate_error_save', 'Kunde inte spara betyget.'), 'notice');
      }

      if (btn) btn.disabled = false;
      await renderAll();
      return;
    }

    try { markDealRated(pending || { source: sourceRaw, proofRef }); } catch {}
    notifyExtensionDealRated(pending || { source: sourceRaw, proofRef });
    activePending = null;
    clearPending();

    showNotification('success', t('rate_success_saved_toast', 'Tack! Ditt omdöme är sparat.'), 'notice');
    form.reset();
    if (btn) btn.disabled = false;

    await renderAll();
  } catch (err) {
    console.error('submit error', err);
    showNotification('error', t('rate_error_technical', 'Tekniskt fel. Försök igen om en stund.'), 'notice');
    if (btn) btn.disabled = false;
  }
}