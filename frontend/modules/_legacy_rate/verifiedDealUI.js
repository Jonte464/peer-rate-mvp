// frontend/modules/verifiedDealUI.js
import { t } from '../landing/language.js';

export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatAmount(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return '–';
  const cur = currency || 'SEK';
  return `${escapeHtml(String(amount))} ${escapeHtml(cur)}`.trim();
}

export function formatDateShort(date) {
  if (!date) return '–';
  return escapeHtml(String(date));
}

export function formatAddress(cp) {
  const parts = [
    cp?.addressStreet,
    cp?.addressZip,
    cp?.addressCity,
    cp?.country
  ].filter(Boolean).map(x => String(x).trim()).filter(Boolean);
  return parts.length ? escapeHtml(parts.join(', ')) : '–';
}

export function showToast(type, message) {
  try {
    const existing = document.getElementById('pr-toast');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'pr-toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');

    box.style.position = 'fixed';
    box.style.left = '50%';
    box.style.bottom = '22px';
    box.style.transform = 'translateX(-50%)';
    box.style.zIndex = '9999';
    box.style.maxWidth = '92vw';
    box.style.padding = '12px 14px';
    box.style.borderRadius = '14px';
    box.style.boxShadow = '0 10px 30px rgba(0,0,0,.18)';
    box.style.border = '1px solid rgba(0,0,0,.10)';
    box.style.background = '#fff';
    box.style.color = 'var(--pr-text, #111)';
    box.style.fontSize = '14px';
    box.style.fontWeight = '600';

    const bar = document.createElement('div');
    bar.style.height = '3px';
    bar.style.borderRadius = '999px';
    bar.style.marginBottom = '8px';
    bar.style.opacity = '.9';
    bar.style.background = (type === 'success') ? '#16a34a' : '#dc2626';

    const txt = document.createElement('div');
    txt.textContent = message;

    box.appendChild(bar);
    box.appendChild(txt);

    document.body.appendChild(box);

    setTimeout(() => {
      try { box.remove(); } catch {}
    }, 3500);
  } catch {}
}

export function applyPendingContextCard(p) {
  if (!p) return;

  const ctxCard = document.getElementById('rate-context-card');
  const ctxSource = document.getElementById('rate-context-source');
  const ctxLink = document.getElementById('rate-context-link');

  if (ctxCard) ctxCard.style.display = '';
  if (ctxSource) ctxSource.textContent = (p.source || '–');

  if (ctxLink && p.pageUrl) {
    ctxLink.href = p.pageUrl;
    ctxLink.style.display = '';
  } else if (ctxLink) {
    ctxLink.style.display = 'none';
  }
}

/**
 * Renderar "Verifierad affär"-kortet.
 * (Observera: skapar INTE locked form längre — det gör lockedRatingCard/orchestrator)
 */
export function renderVerifiedDealUI(p) {
  const emptyEl = document.getElementById('verified-empty');
  const listEl = document.getElementById('verified-list');
  if (!emptyEl || !listEl) return;

  const hasAnything = !!(p?.proofRef || p?.pageUrl || p?.subjectEmail || p?.counterparty?.email);
  if (!p || !hasAnything) {
    emptyEl.style.display = '';
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.style.display = '';
  listEl.innerHTML = '';

  const deal = p.deal || {};
  const cp = p.counterparty || {};
  const cpEmail = p.subjectEmail || cp.email || '–';
  const cpName = cp.name || '–';
  const cpPhone = cp.phone || '–';
  const cpAddress = formatAddress(cp);

  const orderId = deal.orderId || p.proofRef || '–';
  const amount = (deal.amount != null) ? deal.amount : (deal.amountSek != null ? deal.amountSek : null);
  const currency = deal.currency || (amount != null ? 'SEK' : '');
  const date = deal.date || deal.dateISO || '';

  const card = document.createElement('div');
  card.style.border = '1px solid rgba(0,0,0,.08)';
  card.style.background = '#fff';
  card.style.borderRadius = '16px';
  card.style.padding = '14px';
  card.style.boxShadow = '0 12px 34px rgba(0,0,0,.04)';

  const title = document.createElement('div');
  title.style.display = 'flex';
  title.style.justifyContent = 'space-between';
  title.style.alignItems = 'center';
  title.style.gap = '10px';
  title.style.flexWrap = 'wrap';
  title.style.marginBottom = '12px';
  title.innerHTML = `
    <div style="font-weight:900;color:var(--pr-purple);">${escapeHtml(t('rate_verified_card_title', 'Verifierad affär'))}</div>
    <div style="font-size:12px;color:var(--pr-muted);font-weight:700;">${escapeHtml(p.source || '–')}</div>
  `;

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  grid.style.gap = '10px';

  const valStyle = 'font-weight:600;word-break:break-word;';
  const labelStyle = 'font-size:12px;color:var(--pr-muted);';

  grid.innerHTML = `
    <div>
      <div style="${labelStyle}">${escapeHtml(t('rate_label_source', 'Källa'))}</div>
      <div style="${valStyle}">${escapeHtml(p.source || '–')}</div>
    </div>
    <div>
      <div style="${labelStyle}">${escapeHtml(t('rate_label_order_proof', 'Order/Proof'))}</div>
      <div style="${valStyle}">${escapeHtml(orderId)}</div>
    </div>

    <div>
      <div style="${labelStyle}">${escapeHtml(t('rate_label_counterparty_email', 'Motpart (e-post)'))}</div>
      <div style="${valStyle}">${escapeHtml(cpEmail)}</div>
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
      <div style="${labelStyle}">${escapeHtml(t('rate_label_amount', 'Belopp'))}</div>
      <div style="${valStyle}">${formatAmount(amount, currency)}</div>
    </div>
    <div>
      <div style="${labelStyle}">${escapeHtml(t('rate_label_date', 'Datum'))}</div>
      <div style="${valStyle}">${formatDateShort(date)}</div>
    </div>
  `;

  const actions = document.createElement('div');
  actions.style.marginTop = '12px';
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.flexWrap = 'wrap';
  actions.style.alignItems = 'center';

  const link = document.createElement('a');
  link.href = p.pageUrl || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = t('rate_view_source', 'Visa källan →');
  link.style.fontWeight = '700';
  link.style.textDecoration = 'none';
  link.style.color = '#1d4ed8';
  link.style.display = p.pageUrl ? 'inline-block' : 'none';

  actions.appendChild(link);
  card.appendChild(title);
  card.appendChild(grid);
  card.appendChild(actions);

  listEl.appendChild(card);
}