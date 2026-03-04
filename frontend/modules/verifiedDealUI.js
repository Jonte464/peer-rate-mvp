// frontend/modules/verifiedDealUI.js

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

    const t = document.createElement('div');
    t.id = 'pr-toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');

    t.style.position = 'fixed';
    t.style.left = '50%';
    t.style.bottom = '22px';
    t.style.transform = 'translateX(-50%)';
    t.style.zIndex = '9999';
    t.style.maxWidth = '92vw';
    t.style.padding = '12px 14px';
    t.style.borderRadius = '14px';
    t.style.boxShadow = '0 10px 30px rgba(0,0,0,.18)';
    t.style.border = '1px solid rgba(0,0,0,.10)';
    t.style.background = '#fff';
    t.style.color = 'var(--pr-text, #111)';
    t.style.fontSize = '14px';
    t.style.fontWeight = '600';

    const bar = document.createElement('div');
    bar.style.height = '3px';
    bar.style.borderRadius = '999px';
    bar.style.marginBottom = '8px';
    bar.style.opacity = '.9';
    bar.style.background = (type === 'success') ? '#16a34a' : '#dc2626';

    const txt = document.createElement('div');
    txt.textContent = message;

    t.appendChild(bar);
    t.appendChild(txt);

    document.body.appendChild(t);

    setTimeout(() => {
      try { t.remove(); } catch {}
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
  card.style.borderRadius = '14px';
  card.style.padding = '12px';

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  grid.style.gap = '10px';

  const valStyle = 'font-weight:600;word-break:break-word;';

  grid.innerHTML = `
    <div>
      <div style="font-size:12px;color:var(--pr-muted);">Källa</div>
      <div style="${valStyle}">${escapeHtml(p.source || '–')}</div>
    </div>
    <div>
      <div style="font-size:12px;color:var(--pr-muted);">Order/Proof</div>
      <div style="${valStyle}">${escapeHtml(orderId)}</div>
    </div>

    <div>
      <div style="font-size:12px;color:var(--pr-muted);">Motpart (e-post)</div>
      <div style="${valStyle}">${escapeHtml(cpEmail)}</div>
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
      <div style="font-size:12px;color:var(--pr-muted);">Belopp</div>
      <div style="${valStyle}">${formatAmount(amount, currency)}</div>
    </div>
    <div>
      <div style="font-size:12px;color:var(--pr-muted);">Datum</div>
      <div style="${valStyle}">${formatDateShort(date)}</div>
    </div>
  `;

  const actions = document.createElement('div');
  actions.style.marginTop = '10px';
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.flexWrap = 'wrap';
  actions.style.alignItems = 'center';

  const link = document.createElement('a');
  link.href = p.pageUrl || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Visa källan →';
  link.style.fontWeight = '700';
  link.style.textDecoration = 'none';
  link.style.color = '#1d4ed8';
  link.style.display = p.pageUrl ? 'inline-block' : 'none';

  actions.appendChild(link);
  card.appendChild(grid);
  card.appendChild(actions);

  listEl.appendChild(card);
}