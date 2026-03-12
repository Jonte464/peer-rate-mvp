// frontend/modules/lockedRatingCard.js
import { showNotification } from './utils.js';
import auth from './auth.js';
import api from './api.js';
import { getPending, clearPending } from './pendingStore.js';
import { clearAllPendingEverywhere } from './ratingContext.js';
import { t } from './landing/language.js';
import { escapeHtml, formatAmount, formatDateShort, formatAddress, showToast } from './verifiedDealUI.js';

export function sanitizeCounterparty(cp, deal) {
  if (!cp || typeof cp !== 'object') return undefined;

  const platform = (deal?.platform || cp.platform || '').toString().toUpperCase();
  const username = cp.platformUsername || cp.username || null;

  const clean = {
    email: cp.email || undefined,
    name: cp.name || undefined,
    phone: cp.phone || undefined,
    addressStreet: cp.addressStreet || undefined,
    addressZip: cp.addressZip || undefined,
    addressCity: cp.addressCity || undefined,
    country: cp.country || undefined,

    platform: platform || undefined,
    platformUsername: username || undefined,
    pageUrl: cp.pageUrl || deal?.pageUrl || undefined,

    orderId: cp.orderId || deal?.orderId || undefined,
    itemId: cp.itemId || deal?.itemId || undefined,
    amountSek: (cp.amountSek ?? deal?.amountSek ?? undefined),
    title: cp.title || deal?.title || undefined,
  };

  Object.keys(clean).forEach((k) => {
    if (clean[k] === undefined || clean[k] === null || clean[k] === '') delete clean[k];
  });

  if (!clean.email) return undefined;
  return clean;
}

export function isDuplicateRatingError(result) {
  const msg = (result?.error || result?.message || '').toString().toLowerCase();
  const raw = (result?.raw || '').toString().toLowerCase();

  if (result?.status === 409) return true;
  if (msg.includes('duplicate')) return true;
  if (msg.includes('already') && (msg.includes('rating') || msg.includes('betyg') || msg.includes('omdöme'))) return true;
  if (msg.includes('redan') && (msg.includes('lämn') || msg.includes('skick'))) return true;
  if (raw.includes('duplicate')) return true;
  return false;
}

function setSubmitLoading(form, isLoading) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;

  if (isLoading) {
    if (!btn.dataset.origText) btn.dataset.origText = btn.textContent || t('rate_submit_rating', 'Skicka omdöme');
    btn.disabled = true;
    btn.textContent = t('rate_submit_loading', 'Skickar…');
    btn.style.opacity = '.75';
    btn.style.pointerEvents = 'none';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.origText || t('rate_submit_rating', 'Skicka omdöme');
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }
}

function showLockedSuccessCard(message) {
  const form = document.getElementById('locked-rating-form');
  if (!form) return;

  form.innerHTML = `
    <div style="
      border:1px solid rgba(22,163,74,.35);
      background:rgba(22,163,74,.10);
      border-radius:14px;
      padding:12px;
    ">
      <div style="font-weight:800; margin-bottom:6px;">${escapeHtml(t('rate_success_title', 'Tack för ditt omdöme! ✅'))}</div>
      <div style="color:var(--pr-text,#111); font-weight:600;">${escapeHtml(message || t('rate_success_body', 'Ditt omdöme är registrerat.'))}</div>
      <div style="margin-top:10px; font-size:13px; color:var(--pr-muted);">
        ${escapeHtml(t('rate_success_next', 'Du kan nu stänga sidan eller gå till din profil.'))}
      </div>
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <a class="pr-btn" href="/profile.html" style="text-decoration:none;">${escapeHtml(t('rate_go_profile', 'Gå till profil'))}</a>
        <a class="pr-btn pr-btn-primary" href="/" style="text-decoration:none;">${escapeHtml(t('rate_go_home', 'Till startsidan'))}</a>
      </div>
    </div>
  `;
}

function getLockedAuthHintMarkup(isLoggedIn) {
  if (isLoggedIn) return '';

  return `
    <div id="locked-auth-hint" style="
      border:1px solid rgba(245,158,11,.28);
      background:rgba(245,158,11,.10);
      border-radius:14px;
      padding:12px;
      margin-bottom:12px;
    ">
      <div style="font-weight:800; margin-bottom:4px;">
        ${escapeHtml(t('rate_login_required_title', 'Logga in för att skicka omdömet'))}
      </div>
      <div style="font-size:13px; color:var(--pr-text,#111); line-height:1.5;">
        ${escapeHtml(t('rate_login_required_body', 'Affären är identifierad och formuläret är förifyllt, men du behöver logga in innan du kan skicka ditt omdöme.'))}
      </div>
    </div>
  `;
}

function getLockedFormMarkup(isLoggedIn) {
  return `
    <h2 style="margin:0 0 8px;">${escapeHtml(t('rate_step3_title', 'Steg 3: Lämna omdöme'))}</h2>
    <p style="margin:0 0 12px;color:var(--pr-muted);font-size:13px;line-height:1.55;">
      ${escapeHtml(t('rate_step3_lead', 'Formuläret är låst till verifierad affär. Du kan bara välja betyg och skriva kommentar.'))}
    </p>

    ${getLockedAuthHintMarkup(isLoggedIn)}

    <div id="locked-meta" style="border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:14px;padding:12px;margin-bottom:12px;"></div>

    <form id="locked-rating-form" autocomplete="off">
      <input type="hidden" name="ratedUserEmail" />
      <input type="hidden" name="source" />
      <input type="hidden" name="proofRef" />
      <input type="hidden" name="rater" />

      <div class="pr-field">
        <label class="pr-label" for="locked-score">${escapeHtml(t('rate_score_label', 'Betyg'))}</label>
        <select class="pr-select" id="locked-score" name="score" required ${isLoggedIn ? '' : 'disabled'}>
          <option value="" selected>${escapeHtml(t('rate_pick_score', 'Välj…'))}</option>
          <option value="1">${escapeHtml(t('rate_score_1', '1 – Mycket dåligt'))}</option>
          <option value="2">${escapeHtml(t('rate_score_2', '2 – Dåligt'))}</option>
          <option value="3">${escapeHtml(t('rate_score_3', '3 – Okej'))}</option>
          <option value="4">${escapeHtml(t('rate_score_4', '4 – Bra'))}</option>
          <option value="5">${escapeHtml(t('rate_score_5', '5 – Mycket bra'))}</option>
        </select>
      </div>

      <div class="pr-field">
        <label class="pr-label" for="locked-comment">${escapeHtml(t('rate_comment_label', 'Kommentar (valfritt)'))}</label>
        <textarea
          class="pr-textarea"
          id="locked-comment"
          name="comment"
          rows="4"
          placeholder="${escapeHtml(t('rate_comment_ph', 'Vad fungerade bra eller dåligt?'))}"
          ${isLoggedIn ? '' : 'disabled'}
        ></textarea>
      </div>

      <div class="pr-actions">
        <button class="pr-btn pr-btn-primary" type="submit" ${isLoggedIn ? '' : 'disabled'}>${escapeHtml(t('rate_submit_rating', 'Skicka omdöme'))}</button>
      </div>

      <div id="locked-notice" class="notice" style="margin-top:10px;"></div>
    </form>
  `;
}

function bindLockedFormSubmitOnce() {
  const form = document.getElementById('locked-rating-form');
  if (!form || form.dataset.bound === '1') return;

  form.dataset.bound = '1';
  form.addEventListener('submit', handleLockedSubmit);
}

export function removeLockedFormCard() {
  const el = document.getElementById('locked-rating-card');
  if (el) el.remove();
}

export function ensureLockedFormCard(p, user) {
  const isLoggedIn = !!user;
  let card = document.getElementById('locked-rating-card');

  if (!card) {
    const anchor = document.getElementById('verified-deals-card') || document.getElementById('rate-context-card');
    if (!anchor || !anchor.parentElement) return;

    card = document.createElement('section');
    card.className = 'pr-card';
    card.id = 'locked-rating-card';
    card.style.marginTop = '16px';
    card.style.marginBottom = '16px';

    anchor.parentElement.insertBefore(card, anchor.nextSibling);
  }

  card.style.display = 'block';
  card.innerHTML = getLockedFormMarkup(isLoggedIn);
  bindLockedFormSubmitOnce();
  updateLockedFormWithPending(p, user);
}

export function updateLockedFormWithPending(p, user) {
  const meta = document.getElementById('locked-meta');
  const form = document.getElementById('locked-rating-form');
  if (!meta || !form) return;

  const deal = p?.deal || {};
  const cp = p?.counterparty || {};
  const cpEmail = p?.subjectEmail || cp.email || '';
  const cpName = cp.name || '–';
  const cpPhone = cp.phone || '–';
  const cpAddress = formatAddress(cp);

  const orderId = deal.orderId || p?.proofRef || '–';
  const amount = (deal.amount != null) ? deal.amount : (deal.amountSek != null ? deal.amountSek : null);
  const currency = deal.currency || (amount != null ? 'SEK' : '');
  const date = deal.date || deal.dateISO || '';

  const valStyle = 'font-weight:600;word-break:break-word;';
  const labelStyle = 'font-size:12px;color:var(--pr-muted);';

  meta.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
      <div>
        <div style="${labelStyle}">${escapeHtml(t('rate_label_counterparty_email', 'Motpart (e-post)'))}</div>
        <div style="${valStyle}">${escapeHtml(cpEmail || '–')}</div>
      </div>
      <div>
        <div style="${labelStyle}">${escapeHtml(t('rate_label_source', 'Källa'))}</div>
        <div style="${valStyle}">${escapeHtml(p?.source || '–')}</div>
      </div>

      <div>
        <div style="${labelStyle}">${escapeHtml(t('rate_label_name', 'Namn'))}</div>
        <div style="${valStyle}">${escapeHtml(cpName)}</div>
      </div>
      <div>
        <div style="${labelStyle}">${escapeHtml(t('rate_label_phone', 'Telefon'))}</div>
        <div style="${valStyle}">${escapeHtml(cpPhone)}</div>
      </div>

      <div>
        <div style="${labelStyle}">${escapeHtml(t('rate_label_address', 'Adress'))}</div>
        <div style="${valStyle}">${cpAddress}</div>
      </div>
      <div>
        <div style="${labelStyle}">${escapeHtml(t('rate_label_order_proof', 'Order/Proof'))}</div>
        <div style="${valStyle}">${escapeHtml(orderId)}</div>
      </div>

      <div>
        <div style="${labelStyle}">${escapeHtml(t('rate_label_amount', 'Belopp'))}</div>
        <div style="${valStyle}">${formatAmount(amount, currency)}</div>
      </div>
      <div>
        <div style="${labelStyle}">${escapeHtml(t('rate_label_date', 'Datum'))}</div>
        <div style="${valStyle}">${formatDateShort(date)}</div>
      </div>
    </div>
  `;

  const ratedInput = form.querySelector('input[name="ratedUserEmail"]');
  const sourceInput = form.querySelector('input[name="source"]');
  const proofInput = form.querySelector('input[name="proofRef"]');
  const raterInput = form.querySelector('input[name="rater"]');

  if (ratedInput) ratedInput.value = cpEmail || '';
  if (sourceInput) sourceInput.value = p?.source || '';
  if (proofInput) proofInput.value = p?.proofRef || '';
  if (raterInput) raterInput.value = user?.email || '';

  const isLoggedIn = !!user;
  const scoreEl = form.querySelector('select[name="score"]');
  const commentEl = form.querySelector('textarea[name="comment"]');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (scoreEl) scoreEl.disabled = !isLoggedIn;
  if (commentEl) commentEl.disabled = !isLoggedIn;
  if (submitBtn) submitBtn.disabled = !isLoggedIn;
}

async function handleLockedSubmit(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const user = auth.getUser?.() || null;
  if (!user) {
    showNotification('error', t('rate_error_login_required', 'Du måste logga in för att skicka omdöme.'), 'locked-notice');
    return;
  }

  const subjectEmail = form.querySelector('input[name="ratedUserEmail"]')?.value?.trim() || '';
  const score = Number(form.querySelector('select[name="score"]')?.value || 0);
  const comment = form.querySelector('textarea[name="comment"]')?.value?.trim() || '';
  const proofRef = form.querySelector('input[name="proofRef"]')?.value?.trim() || '';
  const sourceRaw = form.querySelector('input[name="source"]')?.value?.trim() || '';
  const raterVal = form.querySelector('input[name="rater"]')?.value?.trim() || user.email;

  if (!subjectEmail) {
    showNotification('error', t('rate_error_missing_counterparty', 'Motpart saknas i verifierad affär.'), 'locked-notice');
    return;
  }
  if (!score) {
    showNotification('error', t('rate_error_pick_score', 'Välj ett betyg.'), 'locked-notice');
    return;
  }

  const pending = getPending();
  const rawCounterparty = pending?.counterparty || pending?.deal?.counterparty || null;
  const deal = pending?.deal || null;
  const counterparty = sanitizeCounterparty(rawCounterparty, deal);

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

  setSubmitLoading(form, true);

  try {
    const result = await api.createRating(payload);
    if (!result || result.ok === false) {
      if (isDuplicateRatingError(result)) {
        clearAllPendingEverywhere();
        clearPending();
        showNotification('error', t('rate_error_duplicate', 'Omdöme har redan lämnats för denna affär.'), 'locked-notice');
      } else {
        showNotification('error', result?.error || t('rate_error_save', 'Kunde inte spara betyget.'), 'locked-notice');
      }
      setSubmitLoading(form, false);
      return;
    }

    showLockedSuccessCard(t('rate_success_saved', 'Ditt omdöme är sparat.'));
    showToast('success', t('rate_success_saved_toast', 'Tack! Ditt omdöme är sparat.'));

    clearAllPendingEverywhere();
    clearPending();

    setSubmitLoading(form, false);

  } catch (err) {
    console.error('locked submit error', err);
    showNotification('error', t('rate_error_technical', 'Tekniskt fel. Försök igen om en stund.'), 'locked-notice');
    setSubmitLoading(form, false);
  }
}