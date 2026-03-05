// frontend/modules/lockedRatingCard.js
import { showNotification } from './utils.js';
import auth from './auth.js';
import api from './api.js';
import { getPending, clearPending } from './pendingStore.js';
import { clearAllPendingEverywhere } from './ratingContext.js';
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
    if (!btn.dataset.origText) btn.dataset.origText = btn.textContent || 'Skicka omdöme';
    btn.disabled = true;
    btn.textContent = 'Skickar…';
    btn.style.opacity = '.75';
    btn.style.pointerEvents = 'none';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.origText || 'Skicka omdöme';
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
      <div style="font-weight:800; margin-bottom:6px;">Tack för ditt omdöme! ✅</div>
      <div style="color:var(--pr-text,#111); font-weight:600;">${escapeHtml(message || 'Ditt omdöme är registrerat.')}</div>
      <div style="margin-top:10px; font-size:13px; color:var(--pr-muted);">
        Du kan nu stänga sidan eller gå till din profil.
      </div>
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <a class="pr-btn" href="/profile.html" style="text-decoration:none;">Gå till profil</a>
        <a class="pr-btn pr-btn-primary" href="/" style="text-decoration:none;">Till startsidan</a>
      </div>
    </div>
  `;
}

export function removeLockedFormCard() {
  const el = document.getElementById('locked-rating-card');
  if (el) el.remove();
}

export function ensureLockedFormCard(p, user) {
  if (document.getElementById('locked-rating-card')) {
    updateLockedFormWithPending(p, user);
    return;
  }

  const anchor = document.getElementById('verified-deals-card') || document.getElementById('rate-context-card');
  if (!anchor || !anchor.parentElement) return;

  const card = document.createElement('section');
  card.className = 'pr-card';
  card.id = 'locked-rating-card';
  card.style.marginBottom = '16px';

  card.innerHTML = `
    <h2 style="margin:0 0 8px;">Steg 3: Lämna omdöme</h2>
    <p style="margin:0 0 12px;color:var(--pr-muted);font-size:13px;line-height:1.55;">
      Formuläret är låst till verifierad affär. Du kan bara välja betyg och skriva kommentar.
    </p>

    <div id="locked-meta" style="border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:14px;padding:12px;margin-bottom:12px;"></div>

    <form id="locked-rating-form" autocomplete="off">
      <input type="hidden" name="ratedUserEmail" />
      <input type="hidden" name="source" />
      <input type="hidden" name="proofRef" />
      <input type="hidden" name="rater" />

      <div class="pr-field">
        <label class="pr-label" for="locked-score">Betyg</label>
        <select class="pr-select" id="locked-score" name="score" required>
          <option value="" selected>Välj…</option>
          <option value="1">1 – Mycket dåligt</option>
          <option value="2">2 – Dåligt</option>
          <option value="3">3 – Okej</option>
          <option value="4">4 – Bra</option>
          <option value="5">5 – Mycket bra</option>
        </select>
      </div>

      <div class="pr-field">
        <label class="pr-label" for="locked-comment">Kommentar (valfritt)</label>
        <textarea class="pr-textarea" id="locked-comment" name="comment" rows="4"
          placeholder="Vad fungerade bra/dåligt?"></textarea>
      </div>

      <div class="pr-actions">
        <button class="pr-btn pr-btn-primary" type="submit">Skicka omdöme</button>
      </div>

      <div id="locked-notice" class="notice" style="margin-top:10px;"></div>
    </form>
  `;

  anchor.parentElement.insertBefore(card, anchor.nextSibling);

  const form = document.getElementById('locked-rating-form');
  if (form) form.addEventListener('submit', handleLockedSubmit);

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

  meta.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Motpart (e-post)</div>
        <div style="${valStyle}">${escapeHtml(cpEmail || '–')}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Källa</div>
        <div style="${valStyle}">${escapeHtml(p?.source || '–')}</div>
      </div>

      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Namn</div>
        <div style="${valStyle}">${escapeHtml(cpName)}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Telefon</div>
        <div style="${valStyle}">${escapeHtml(cpPhone)}</div>
      </div>

      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Adress</div>
        <div style="${valStyle}">${cpAddress}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Order/Proof</div>
        <div style="${valStyle}">${escapeHtml(orderId)}</div>
      </div>

      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Belopp</div>
        <div style="${valStyle}">${formatAmount(amount, currency)}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Datum</div>
        <div style="${valStyle}">${formatDateShort(date)}</div>
      </div>
    </div>
  `;

  form.querySelector('input[name="ratedUserEmail"]').value = cpEmail || '';
  form.querySelector('input[name="source"]').value = p?.source || '';
  form.querySelector('input[name="proofRef"]').value = p?.proofRef || '';
  form.querySelector('input[name="rater"]').value = user?.email || '';
}

async function handleLockedSubmit(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const user = auth.getUser?.() || null;
  if (!user) {
    showNotification('error', 'Du måste logga in för att skicka omdöme.', 'locked-notice');
    return;
  }

  const subjectEmail = form.querySelector('input[name="ratedUserEmail"]')?.value?.trim() || '';
  const score = Number(form.querySelector('select[name="score"]')?.value || 0);
  const comment = form.querySelector('textarea[name="comment"]')?.value?.trim() || '';
  const proofRef = form.querySelector('input[name="proofRef"]')?.value?.trim() || '';
  const sourceRaw = form.querySelector('input[name="source"]')?.value?.trim() || '';
  const raterVal = form.querySelector('input[name="rater"]')?.value?.trim() || user.email;

  if (!subjectEmail) {
    showNotification('error', 'Motpart saknas i verifierad affär.', 'locked-notice');
    return;
  }
  if (!score) {
    showNotification('error', 'Välj ett betyg.', 'locked-notice');
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
        // ✅ Viktigt: rensa pending ÖVERALLT även vid duplicate, annars fastnar overlayn
        clearAllPendingEverywhere();
        clearPending();
        showNotification('error', 'Omdöme har redan lämnats för denna affär.', 'locked-notice');
      } else {
        showNotification('error', result?.error || 'Kunde inte spara betyget.', 'locked-notice');
      }
      setSubmitLoading(form, false);
      return;
    }

    // ✅ Success
    showLockedSuccessCard('Ditt omdöme är sparat.');
    showToast('success', 'Tack! Ditt omdöme är sparat.');

    // ✅ Rensa pending (både sessionStorage + localStorage + legacy)
    clearAllPendingEverywhere();
    clearPending();

    // ingen anledning att återställa loading när vi ersatt formens HTML,
    // men vi gör det ändå för säkerhets skull.
    setSubmitLoading(form, false);

  } catch (err) {
    console.error('locked submit error', err);
    showNotification('error', 'Tekniskt fel. Försök igen om en stund.', 'locked-notice');
    setSubmitLoading(form, false);
  }
}