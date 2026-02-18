// frontend/modules/profileTradera.js
// Visar Tradera-sammanfattning + ordrar på profile.html.
// Bygger "Rate now"-länk som skickar pr=payload till /rate.html (matchar ratingForm.js).

import auth from './auth.js';

function toB64Utf8Json(obj) {
  const json = JSON.stringify(obj);
  const utf8 = unescape(encodeURIComponent(json));
  return btoa(utf8);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmtDate(s) {
  if (!s) return '–';
  const t = String(s);
  return escapeHtml(t.slice(0, 10));
}

function fmtMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return '–';
  const cur = currency || 'SEK';
  return `${escapeHtml(String(amount))} ${escapeHtml(cur)}`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function ensureCard() {
  let card = document.getElementById('tradera-card');
  if (!card) return null;

  // Säkerställ body/containers även om HTML skiljer sig
  if (!card.querySelector('#tradera-status')) {
    const status = document.createElement('div');
    status.id = 'tradera-status';
    status.className = 'notice';
    status.style.margin = '0 0 10px';
    card.appendChild(status);
  }
  if (!card.querySelector('#tradera-body')) {
    const body = document.createElement('div');
    body.id = 'tradera-body';
    card.appendChild(body);
  }

  // Gör synligt (din gamla stub gömde kortet)
  card.classList.remove('hidden');
  card.style.display = '';

  return card;
}

function renderError(card, message) {
  const status = card.querySelector('#tradera-status');
  const body = card.querySelector('#tradera-body');

  if (status) status.textContent = message || 'Kunde inte hämta Tradera-data.';
  if (body) {
    body.innerHTML = `
      <div style="border:1px solid rgba(220,38,38,.25);background:rgba(220,38,38,.06);border-radius:14px;padding:12px;">
        <div style="font-weight:900;margin-bottom:6px;">Tradera-data kunde inte hämtas</div>
        <div style="color:var(--pr-muted);font-size:13px;line-height:1.55;">
          ${escapeHtml(message || 'Okänt fel')}
        </div>
      </div>
    `;
  }
}

function renderEmpty(card, message) {
  const status = card.querySelector('#tradera-status');
  const body = card.querySelector('#tradera-body');

  if (status) status.textContent = message || 'Ingen Tradera-data hittades.';
  if (body) {
    body.innerHTML = `
      <div style="color:var(--pr-muted);font-size:13px;line-height:1.55;">
        ${escapeHtml(message || 'Ingen Tradera-data hittades.')}
      </div>
    `;
  }
}

function buildRateLinkFromOrder(order) {
  const counterpartyEmail = order?.counterpartyEmail || '';
  const orderId = order?.traderaOrderId || '';
  const itemId = order?.traderaItemId || null;

  if (!counterpartyEmail || !orderId) return null;

  const payload = {
    source: 'Tradera',
    subjectEmail: counterpartyEmail,
    proofRef: orderId,
    counterparty: {
      email: counterpartyEmail,
      platform: 'TRADERA',
      platformUsername: order?.counterpartyAlias || undefined,
    },
    deal: {
      platform: 'TRADERA',
      orderId,
      itemId: itemId || undefined,
      title: order?.title || undefined,
      amount: order?.amount || undefined,
      currency: order?.currency || 'SEK',
      dateISO: order?.completedAt || undefined,
    },
  };

  const pr = encodeURIComponent(toB64Utf8Json(payload));
  return `/rate.html?pr=${pr}&source=tradera`;
}

function render(card, data) {
  const status = card.querySelector('#tradera-status');
  const body = card.querySelector('#tradera-body');

  // data kommer från backend/routes/traderaRoutes.js:
  // { ok:true, hasTradera, profile, orders, summary }
  if (!data || data.ok !== true) {
    renderError(card, data?.error || 'Kunde inte läsa Tradera-svar.');
    return;
  }

  if (!data.hasTradera) {
    renderEmpty(card, 'Ingen Tradera-koppling hittades för ditt konto ännu.');
    return;
  }

  const profile = data.profile || {};
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const summary = data.summary || {};

  const total = summary.totalOrders ?? orders.length;
  const rated = summary.ratedOrders ?? orders.filter(o => o.hasRating).length;
  const pending = summary.unratedOrders ?? (total - rated);

  if (status) status.textContent = `Tradera: ${total} affärer • ✅ ${rated} betygsatta • ⏳ ${pending} väntar`;

  const username = profile.username ? escapeHtml(profile.username) : '–';
  const lastSynced = profile.lastSyncedAt ? fmtDate(profile.lastSyncedAt) : '–';

  const rowsHtml = orders.map((o) => {
    const has = !!o.hasRating;
    const badge = has
      ? `<span style="font-weight:900;">✅ Betygsatt</span>`
      : `<span style="font-weight:900;">⏳ Väntar</span>`;

    const rateLink = !has ? buildRateLinkFromOrder(o) : null;
    const btn = rateLink
      ? `<a href="${rateLink}" class="pr-btn pr-btn-primary" style="padding:8px 10px;font-size:13px;text-decoration:none;">Rate now</a>`
      : `<span style="color:var(--pr-muted);font-size:13px;">–</span>`;

    return `
      <tr>
        <td style="padding:10px 8px;border-top:1px solid rgba(0,0,0,.06);">
          <div style="font-weight:900;">${escapeHtml(o.title || '(okänd artikel)')}</div>
          <div style="color:var(--pr-muted);font-size:12px;margin-top:2px;">
            Order: ${escapeHtml(o.traderaOrderId || '–')}
            ${o.traderaItemId ? ` • Item: ${escapeHtml(o.traderaItemId)}` : ''}
          </div>
          <div style="color:var(--pr-muted);font-size:12px;margin-top:2px;">
            Motpart: ${escapeHtml(o.counterpartyAlias || '–')}
            ${o.counterpartyEmail ? ` • ${escapeHtml(o.counterpartyEmail)}` : ''}
          </div>
        </td>

        <td style="padding:10px 8px;border-top:1px solid rgba(0,0,0,.06);white-space:nowrap;">
          ${fmtMoney(o.amount, o.currency)}
        </td>

        <td style="padding:10px 8px;border-top:1px solid rgba(0,0,0,.06);white-space:nowrap;">
          ${fmtDate(o.completedAt)}
        </td>

        <td style="padding:10px 8px;border-top:1px solid rgba(0,0,0,.06);white-space:nowrap;">
          ${badge}
        </td>

        <td style="padding:10px 8px;border-top:1px solid rgba(0,0,0,.06);white-space:nowrap;text-align:right;">
          ${btn}
        </td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:8px 0 12px;">
      <div style="padding:10px 12px;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:#fff;">
        <div style="font-size:12px;color:var(--pr-muted);">Tradera-konto</div>
        <div style="font-weight:900;">${username}</div>
      </div>

      <div style="padding:10px 12px;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:#fff;">
        <div style="font-size:12px;color:var(--pr-muted);">Senast synkat</div>
        <div style="font-weight:900;">${lastSynced}</div>
      </div>
    </div>

    <div style="overflow:auto;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:#fff;">
      <table style="width:100%;border-collapse:collapse;min-width:820px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px 8px;font-size:12px;color:var(--pr-muted);">Affär</th>
            <th style="text-align:left;padding:10px 8px;font-size:12px;color:var(--pr-muted);white-space:nowrap;">Belopp</th>
            <th style="text-align:left;padding:10px 8px;font-size:12px;color:var(--pr-muted);white-space:nowrap;">Datum</th>
            <th style="text-align:left;padding:10px 8px;font-size:12px;color:var(--pr-muted);white-space:nowrap;">Status</th>
            <th style="text-align:right;padding:10px 8px;font-size:12px;color:var(--pr-muted);white-space:nowrap;">Åtgärd</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `
            <tr>
              <td colspan="5" style="padding:14px 10px;color:var(--pr-muted);border-top:1px solid rgba(0,0,0,.06);">
                Inga affärer hittades senaste 12 månaderna.
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;
}

export async function initTraderaSection() {
  const user = auth.getUser?.() || null;
  if (!user?.email) return;

  const card = ensureCard();
  if (!card) return; // om profile.html saknar tradera-card helt

  const email = String(user.email).trim().toLowerCase();
  const url = `/api/tradera/summary?email=${encodeURIComponent(email)}`;

  try {
    const data = await fetchJson(url);
    render(card, data);
  } catch (e) {
    renderError(card, e?.message || 'Kunde inte hämta Tradera-data.');
  }
}
