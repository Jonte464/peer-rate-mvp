// profileTradera.js – Hanterar Tradera-kortet på profilsidan

import { showNotification } from './utils.js';
import api from './api.js';

// Hjälpfunktion: koppla "Skicka omdöme"-knappar per Tradera-affär
function wireTraderaRatingForms(customerEmail, orders) {
  const noticeId = 'tradera-notice';
  if (!Array.isArray(orders) || orders.length === 0) return;

  orders.forEach((o) => {
    if (!o || !o.traderaOrderId || !o.counterpartyAlias) return;

    const formId = `tradera-rate-form-${o.traderaOrderId}`;
    const buttonId = `tradera-rate-submit-${o.traderaOrderId}`;
    const form = document.getElementById(formId);
    const btn = document.getElementById(buttonId);
    if (!form || !btn) return;

    btn.addEventListener('click', async () => {
      const score = Number(
        form.querySelector('select[name="score"]')?.value || 0
      );
      const comment =
        form.querySelector('textarea[name="comment"]')?.value?.trim() || '';

      if (!score || score < 1 || score > 5) {
        showNotification(
          'error',
          'Välj ett betyg mellan 1 och 5 innan du skickar.',
          noticeId
        );
        return;
      }

      // "Ämnet" vi betygsätter: försök först med riktig e-post, annars en
      // pseudo-identifierare så att motparten kan bli en framtida PeerRate-profil.
      const subject =
        o.counterpartyEmail ||
        `tradera:${String(o.counterpartyAlias || o.traderaOrderId)}`;

      const payload = {
        subject,
        rating: score,
        comment: comment || undefined,
        proofRef: `TRADERA_ORDER:${o.traderaOrderId}`,
        source: 'TRADERA',
      };

      btn.disabled = true;
      try {
        const result = await api.createRating(payload);
        if (!result || result.ok === false) {
          const msg =
            (result && (result.error || result.message)) ||
            'Kunde inte spara omdömet för denna affär.';
          showNotification('error', msg, noticeId);
          btn.disabled = false;
          return;
        }

        showNotification(
          'success',
          'Tack! Ditt omdöme för denna affär är sparat.',
          noticeId
        );

        // Uppdatera UI: markera som att omdöme finns
        const meta = form.previousElementSibling;
        if (meta && meta.classList.contains('tradera-order-meta')) {
          meta.innerHTML +=
            ' <span class="tradera-tag">Har omdöme</span>';
        }

        form.innerHTML =
          '<div class="tiny muted">Du har lämnat ett omdöme för denna affär.</div>';
      } catch (err) {
        console.error('Tradera rating submit error', err);
        showNotification(
          'error',
          'Tekniskt fel vid sparande av omdöme. Försök igen om en stund.',
          noticeId
        );
        btn.disabled = false;
      }
    });
  });
}

async function loadTraderaSummaryForEmail(email) {
  const usernameLabel = document.getElementById('tradera-username-label');
  const lastSyncedEl = document.getElementById('tradera-last-synced');
  const ordersList = document.getElementById('tradera-orders-list');
  const ordersSection = document.getElementById('tradera-orders-section');

  if (!ordersList) return;

  // Nollställ
  if (usernameLabel) usernameLabel.textContent = '–';
  if (lastSyncedEl) lastSyncedEl.textContent = '–';
  ordersList.innerHTML =
    '<div class="tiny muted">Hämtar Tradera-data...</div>';

  if (!email) {
    ordersList.innerHTML =
      '<div class="tiny muted">Kunde inte hitta din e-postadress för Tradera-koppling.</div>';
    return;
  }

  try {
    const res = await fetch(
      `/api/tradera/summary?email=${encodeURIComponent(email)}`
    );
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok || !data) {
      console.error('Tradera summary response not OK', res.status, data);
      ordersList.innerHTML =
        '<div class="tiny muted">Kunde inte hämta Tradera-data just nu.</div>';
      return;
    }

    if (data.ok === false) {
      const msg =
        data.error || data.message || 'Kunde inte hämta Tradera-data.';
      ordersList.innerHTML = `<div class="tiny muted">${msg}</div>`;
      return;
    }

    if (!data.hasTradera) {
      ordersList.innerHTML =
        '<div class="tiny muted">Inget Tradera-konto är kopplat ännu.</div>';
      return;
    }

    const profile = data.profile || {};
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const summary = data.summary || {};
    const totalOrders = summary.totalOrders ?? orders.length ?? 0;
    const ratedOrders = summary.ratedOrders ?? 0;
    const unratedOrders =
      summary.unratedOrders ?? Math.max(0, totalOrders - ratedOrders);

    if (usernameLabel) {
      usernameLabel.textContent = profile.username || '–';
    }

    if (lastSyncedEl) {
      if (profile.lastSyncedAt) {
        const d = new Date(profile.lastSyncedAt);
        lastSyncedEl.textContent = isNaN(d.getTime())
          ? String(profile.lastSyncedAt)
          : d.toLocaleString('sv-SE');
      } else {
        lastSyncedEl.textContent = '–';
      }
    }

    // Inga affärer alls
    if (!orders.length) {
      ordersList.innerHTML =
        '<div class="tiny muted">Inga avslutade Tradera-affärer har registrerats senaste 12 månaderna.</div>';
      return;
    }

    if (ordersSection) {
      ordersSection.classList.remove('hidden');
    }

    let html = '';

    // Översiktsrad högst upp
    html += `
      <div class="tiny muted" style="margin-bottom:8px;">
        Du har totalt <strong>${totalOrders}</strong> registrerade Tradera-affärer från de senaste 12 månaderna.
        ${
          unratedOrders > 0
            ? ` <strong>${unratedOrders}</strong> av dem kan du nu ge ett omdöme här.`
            : ' Alla registrerade affärer har redan fått ett omdöme.'
        }
      </div>
    `;

    // Lista med affärer + enkla betygsformulär
    orders.forEach((o) => {
      const title = o.title || '(utan titel)';
      const roleRaw = (o.role || '').toUpperCase();
      const roleLabel =
        roleRaw === 'BUYER'
          ? 'Köpare'
          : roleRaw === 'SELLER'
          ? 'Säljare'
          : '';

      const amount =
        o.amount && o.currency
          ? `${o.amount} ${o.currency}`
          : o.amount
          ? String(o.amount)
          : '';

      let dateStr = '';
      if (o.completedAt) {
        const d = new Date(o.completedAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString('sv-SE');
        }
      }

      const tags = [];
      if (roleLabel) tags.push(roleLabel);
      if (amount) tags.push(amount);
      if (dateStr) tags.push(dateStr);
      if (o.counterpartyAlias) tags.push(`Motpart: ${o.counterpartyAlias}`);

      const tagsHtml = tags
        .map((t) => `<span class="tradera-tag">${t}</span>`)
        .join(' ');

      const formId = `tradera-rate-form-${o.traderaOrderId}`;
      const buttonId = `tradera-rate-submit-${o.traderaOrderId}`;

      html += `
        <div class="tradera-order-row">
          <div class="tradera-order-title">${title}</div>
          <div class="tradera-order-meta">
            ${tagsHtml}
          </div>
          ${
            o.counterpartyAlias
              ? `
          <form id="${formId}" class="tradera-rate-form" style="margin-top:6px;">
            <div class="tiny muted" style="margin-bottom:4px;">
              Ge motparten ett omdöme för denna affär:
            </div>
            <div class="row" style="gap:6px; margin-bottom:4px;">
              <div style="flex:0 0 120px;">
                <select name="score">
                  <option value="0">Välj betyg</option>
                  <option value="5">5 – Mycket bra</option>
                  <option value="4">4 – Bra</option>
                  <option value="3">3 – Okej</option>
                  <option value="2">2 – Dåligt</option>
                  <option value="1">1 – Mycket dåligt</option>
                </select>
              </div>
              <div style="flex:1;">
                <textarea name="comment" placeholder="Kort kommentar (valfritt)"></textarea>
              </div>
            </div>
            <button
              type="button"
              id="${buttonId}"
              class="primary"
              style="font-size:12px; padding:6px 10px; width:auto;"
            >
              Skicka omdöme
            </button>
          </form>
          `
              : `
          <div class="tiny muted" style="margin-top:4px;">
            Ingen namngiven motpart hittades för denna affär, så omdöme kan inte lämnas här.
          </div>
          `
          }
        </div>
      `;
    });

    ordersList.innerHTML = html;

    // Koppla knapparna till API-anrop
    wireTraderaRatingForms(email, orders);
  } catch (err) {
    console.error('Kunde inte ladda Tradera-summary', err);
    ordersList.innerHTML =
      '<div class="tiny muted">Tekniskt fel vid hämtning av Tradera-data.</div>';
  }
}

export async function initTraderaSection() {
  const card = document.getElementById('tradera-card');
  if (!card) return;

  const usernameInput = document.getElementById('tradera-username-input');
  const passwordInput = document.getElementById('tradera-password-input');
  const connectBtn = document.getElementById('tradera-connect-btn');
  const mockBtn = document.getElementById('tradera-mock-btn');
  const noticeId = 'tradera-notice';

  let customerEmail = null;

  try {
    const customer = await api.getCurrentCustomer();
    if (customer) {
      customerEmail = (customer.email || customer.subjectRef || '')
        .trim()
        .toLowerCase();
    }
  } catch (err) {
    console.error('Kunde inte hämta currentCustomer för Tradera', err);
  }

  if (!customerEmail) {
    if (connectBtn) connectBtn.disabled = true;
    if (mockBtn) mockBtn.disabled = true;
    showNotification(
      'error',
      'Kunde inte hämta din profil-e-post. Ladda om sidan och försök igen.',
      noticeId
    );
    return;
  }

  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      const username = (usernameInput?.value || '').trim();
      const password = passwordInput?.value || '';

      if (!username) {
        showNotification(
          'error',
          'Ange ditt Tradera-användarnamn.',
          noticeId
        );
        return;
      }

      connectBtn.disabled = true;

      try {
        const res = await fetch('/api/tradera/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: customerEmail,
            username,
            password: password || undefined,
          }),
        });

        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data || data.ok === false) {
          const msg =
            (data && (data.error || data.message)) ||
            'Kunde inte koppla Tradera-kontot.';
          showNotification('error', msg, noticeId);
        } else {
          showNotification(
            'success',
            'Tradera-kontot är kopplat/uppdaterat.',
            noticeId
          );
          await loadTraderaSummaryForEmail(customerEmail);
        }
      } catch (err) {
        console.error('Tradera connect error (frontend)', err);
        showNotification(
          'error',
          'Tekniskt fel vid koppling mot Tradera.',
          noticeId
        );
      } finally {
        connectBtn.disabled = false;
      }
    });
  }

  // Ny knapp: skapa demoaffärer via /api/tradera/mock-orders
  if (mockBtn) {
    mockBtn.addEventListener('click', async () => {
      mockBtn.disabled = true;
      showNotification(
        'success',
        'Skapar demoaffärer från Tradera...',
        noticeId
      );

      try {
        const res = await fetch('/api/tradera/mock-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: customerEmail }),
        });

        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data || data.ok === false) {
          const msg =
            (data && (data.error || data.message)) ||
            'Kunde inte skapa demoaffärer.';
          showNotification('error', msg, noticeId);
        } else {
          showNotification(
            'success',
            'Demoaffärer har skapats. Listan uppdateras nu.',
            noticeId
          );
          await loadTraderaSummaryForEmail(customerEmail);
        }
      } catch (err) {
        console.error('Tradera mock-orders error (frontend)', err);
        showNotification(
          'error',
          'Tekniskt fel vid skapande av demoaffärer. Försök igen om en stund.',
          noticeId
        );
      } finally {
        mockBtn.disabled = false;
      }
    });
  }

  // Ladda ev. befintlig Tradera-data vid init
  await loadTraderaSummaryForEmail(customerEmail);
}
