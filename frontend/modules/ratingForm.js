// frontend/modules/ratingForm.js
import { showNotification } from './utils.js';
import auth, { login } from './auth.js';
import api from './api.js';
import { t } from './landing/language.js';

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

  if (isLoggedIn) {
    hideLoginCard();
  } else if (hasLoginTargets) {
    showLoginCardIfPresent();
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

async function syncPendingStatusWithBackend() {
  const pending = getPending();
  if (!pending || !hasPendingIdentity(pending)) {
    return { ok: true, alreadyRated: false };
  }

  try {
    const status = await api.checkRatingDealStatus(pending);

    if (status?.ok && status.alreadyRated) {
      try { markDealRated(pending); } catch {}
      notifyExtensionDealRated(pending);
      clearPending();
      return status;
    }

    return status || { ok: false };
  } catch (err) {
    console.warn('[PeerRate] syncPendingStatusWithBackend failed:', err);
    return { ok: false };
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePendingCapturedOnce() {
  const fromUrl = captureFromUrl();
  if (fromUrl) return fromUrl;

  const existing = getPending();
  if (existing) return existing;

  const fromBridge = await captureFromExtensionBridge(1400);
  if (fromBridge) return fromBridge;

  return getPending();
}

async function ensurePendingCapturedRobust({
  attempts = 8,
  delayMs = 350,
} = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const pending = await ensurePendingCapturedOnce();
    if (pending) return pending;

    if (i < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return getPending();
}

async function renderAll() {
  const p = getPending();

  if (p && isDealRated(p)) {
    notifyExtensionDealRated(p);
    clearPending();
    renderVerifiedDealUI(null);
    removeLockedFormCard();
    return;
  }

  if (p) {
    applyPendingContextCard(p);
  }

  renderVerifiedDealUI(p);

  const u = await resolveAuthUser();
  setVisibility(!!u);

  if (p) {
    ensureLockedFormCard(p, u);
  } else {
    removeLockedFormCard();
  }
}

async function bootstrapPendingAndRender() {
  const pending = await ensurePendingCapturedRobust({
    attempts: 10,
    delayMs: 350,
  });

  if (pending && isDealRated(pending)) {
    notifyExtensionDealRated(pending);
    clearPending();
    renderVerifiedDealUI(null);
  } else if (pending) {
    applyPendingContextCard(pending);
    renderVerifiedDealUI(pending);
  } else {
    renderVerifiedDealUI(null);
  }

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
}

async function openPendingRatingFlow() {
  await ensurePendingCapturedRobust({
    attempts: 8,
    delayMs: 250,
  });

  await renderAll();

  const user = await resolveAuthUser();
  const shouldScrollToLogin = !user;

  const tryScroll = async (attempt = 0) => {
    const loginCard =
      document.getElementById('login-card') ||
      document.getElementById('rating-login-card') ||
      document.getElementById('rating-login-form');

    const lockedCard = document.getElementById('locked-rating-card');

    if (shouldScrollToLogin && loginCard) {
      loginCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (!shouldScrollToLogin && lockedCard) {
      lockedCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (attempt < 10) {
      await sleep(220);
      await renderAll();
      return tryScroll(attempt + 1);
    }

    // sista fallback om något fortfarande segar
    const fallback =
      lockedCard ||
      loginCard ||
      document.getElementById('rate-context-card');

    if (fallback) {
      fallback.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  await tryScroll(0);
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
      void renderAll();
    });

    window.addEventListener('pr:pending-cleared', () => {
      void renderAll();
    });

    window.addEventListener('pr:open-pending-rating', () => {
      void openPendingRatingFlow();
    });
  }

  window.addEventListener('storage', () => {
    void renderAll();
  });

  void bootstrapPendingAndRender();

  if (isRatePage()) {
    setTimeout(() => {
      if (!getPending()) {
        void bootstrapPendingAndRender();
      }
    }, 1000);

    setTimeout(() => {
      if (!getPending()) {
        void bootstrapPendingAndRender();
      }
    }, 2200);
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

    if (isRatePage()) {
      await openPendingRatingFlow();
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
      if (isDuplicateRatingError(result)) {
        try { markDealRated(pending || { source: sourceRaw, proofRef }); } catch {}
        notifyExtensionDealRated(pending || { source: sourceRaw, proofRef });
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