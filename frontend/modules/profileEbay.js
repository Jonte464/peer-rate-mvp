// frontend/modules/profileEbay.js
// Alternativ A (fortsättning): Visa kopplingsstatus + hämta/rendera eBay-ordrar

import { showNotification } from './utils.js';
import auth from './auth.js';

/**
 * Hämtar e-post för nuvarande inloggade användare.
 * Försöker först med user.email, annars subjectRef.
 */
function getCurrentUserEmail() {
  try {
    const user = auth.getUser();
    if (!user) return null;
    const email =
      (user.email && String(user.email).trim()) ||
      (user.subjectRef && String(user.subjectRef).trim()) ||
      null;
    return email ? email.toLowerCase() : null;
  } catch (err) {
    console.error('getCurrentUserEmail error', err);
    return null;
  }
}

function safeText(v) {
  if (v === undefined || v === null || v === '') return '–';
  return String(v);
}

function formatDateTime(iso) {
  if (!iso) return '–';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('sv-SE');
  } catch {
    return String(iso);
  }
}

/**
 * Rendera orders på sidan
 */
function renderOrders(container, data) {
  if (!container) return;

  const total = Number(data?.total || 0);
  const orders = Array.isArray(data?.orders) ? data.orders : [];

  if (!orders.length) {
    container.innerHTML = `
      <div class="tiny muted">Inga eBay-ordrar hittades (total: ${total}).</div>
    `;
    return;
  }

  const rows = orders.map((o) => {
    const orderId = safeText(o?.orderId || o?.order_id || o?.id);
    const created = formatDateTime(
      o?.creationDate || o?.creation_date || o?.createdDate || o?.creation_date_time
    );
    const status = safeText(o?.orderStatus || o?.order_status || o?.status);

    // eBay kan ha pricingSummary.total som { value, currency }
    const amountObj = o?.pricingSummary?.total || o?.totalAmount || o?.total;
    const amount =
      amountObj && typeof amountObj === 'object'
        ? `${safeText(amountObj.value)} ${safeText(amountObj.currency)}`
        : safeText(amountObj);

    return `
      <div class="rating-card" style="margin-top:10px;">
        <div class="rating-meta">
          <span class="chip">eBay</span>
          <span class="chip">Order: ${orderId}</span>
          <span class="chip">Datum: ${created}</span>
          <span class="chip">Status: ${status}</span>
          <span class="chip">Summa: ${amount}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="tiny muted">Hittade ${orders.length} ordrar (total: ${total}).</div>
    ${rows.join('')}
  `;
}

/**
 * Uppdatera enkel statusrad i eBay-sektionen:
 * - Kopplad: Ja/Nej
 * - Senast uppdaterad
 */
function renderStatus({ statusLineEl, isConnected, lastSyncedAt }) {
  if (!statusLineEl) return;

  const connectedText = isConnected ? 'Ja' : 'Nej';
  const lastText = lastSyncedAt ? formatDateTime(lastSyncedAt) : '–';

  statusLineEl.innerHTML = `
    <span class="chip">Kopplad: ${connectedText}</span>
    <span class="chip">Senast uppdaterad: ${lastText}</span>
  `;
}

/**
 * Hämtar status från backend (kräver ny endpoint, se nedan)
 */
async function fetchEbayStatus(email) {
  const resp = await fetch(`/api/ebay/status?email=${encodeURIComponent(email)}`);
  const json = await resp.json().catch(() => null);

  if (!resp.ok || !json || json.ok === false) {
    const msg =
      (json && (json.error || json.message)) ||
      `Kunde inte läsa eBay-status (HTTP ${resp.status}).`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Hämtar orders från backend
 */
async function fetchEbayOrders(email) {
  const resp = await fetch(`/api/ebay/orders?email=${encodeURIComponent(email)}`);
  const json = await resp.json().catch(() => null);

  if (!resp.ok || !json || json.ok === false) {
    const msg =
      (json && (json.error || json.message)) ||
      `Kunde inte hämta eBay-ordrar (HTTP ${resp.status}).`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Initierar eBay-sektionen om rätt element finns i DOM.
 * Förväntar sig:
 *  - Knapp id="ebay-connect-btn"
 *  - Knapp id="ebay-orders-btn"
 *  - Status-element id="ebay-status"
 *  - Statusrad id="ebay-status-line" (ny i HTML)
 *  - Lista id="ebay-orders-list"
 */
export async function initEbaySection() {
  try {
    const connectBtn = document.getElementById('ebay-connect-btn');
    const ordersBtn = document.getElementById('ebay-orders-btn');
    const statusElId = 'ebay-status';
    const statusLineEl = document.getElementById('ebay-status-line');
    const ordersList = document.getElementById('ebay-orders-list');

    if (!connectBtn && !ordersBtn) return;

    const email = getCurrentUserEmail();
    if (!email) {
      if (connectBtn) {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Logga in för att koppla eBay';
      }
      if (ordersBtn) {
        ordersBtn.disabled = true;
        ordersBtn.textContent = 'Logga in för att hämta ordrar';
      }
      renderStatus({ statusLineEl, isConnected: false, lastSyncedAt: null });
      return;
    }

    // 1) Läs status direkt när sidan laddas (om endpoint finns)
    try {
      const s = await fetchEbayStatus(email);
      renderStatus({
        statusLineEl,
        isConnected: !!s.isConnected,
        lastSyncedAt: s.lastSyncedAt || null,
      });

      // Om inte kopplad → disable “Hämta ordrar”
      if (ordersBtn) ordersBtn.disabled = !s.isConnected;
    } catch (e) {
      // Om status-endpoint saknas eller fel → visa neutral status men låt UI fungera
      console.warn('eBay status not available yet:', e?.message);
      renderStatus({ statusLineEl, isConnected: false, lastSyncedAt: null });
      // Låt orders-knappen vara enabled (vi låter backend avgöra)
      if (ordersBtn) ordersBtn.disabled = false;
    }

    // ---------- KOPPLA EBAY ----------
    if (connectBtn && !connectBtn._ebayClickBound) {
      connectBtn._ebayClickBound = true;

      if (!connectBtn.textContent || connectBtn.textContent.trim() === '') {
        connectBtn.textContent = 'Koppla eBay-konto';
      }

      connectBtn.addEventListener('click', async () => {
        try {
          connectBtn.disabled = true;
          const originalText = connectBtn.textContent;
          connectBtn.textContent = 'Kopplar eBay...';

          const response = await fetch('/api/integrations/ebay/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          const data = await response.json().catch(() => null);

          if (!response.ok || !data || data.ok === false || !data.redirectUrl) {
            const msg =
              (data && (data.error || data.message)) ||
              'Kunde inte skapa eBay-koppling. Försök igen om en stund.';
            showNotification('error', msg, statusElId);
            connectBtn.disabled = false;
            connectBtn.textContent = originalText;
            return;
          }

          window.location.href = data.redirectUrl;
        } catch (err) {
          console.error('eBay connect frontend error', err);
          showNotification(
            'error',
            'Tekniskt fel vid eBay-koppling. Försök igen om en stund.',
            statusElId
          );
          connectBtn.disabled = false;
          connectBtn.textContent = 'Koppla eBay-konto';
        }
      });
    }

    // ---------- HÄMTA ORDERS ----------
    if (ordersBtn && !ordersBtn._ebayOrdersBound) {
      ordersBtn._ebayOrdersBound = true;

      ordersBtn.addEventListener('click', async () => {
        try {
          ordersBtn.disabled = true;
          const originalText = ordersBtn.textContent;
          ordersBtn.textContent = 'Hämtar eBay-ordrar...';

          const json = await fetchEbayOrders(email);

          renderOrders(ordersList, json.data);
          showNotification('success', 'eBay-ordrar uppdaterade.', statusElId);

          // Uppdatera status igen efter hämtning (så “Senast uppdaterad” blir rätt)
          try {
            const s = await fetchEbayStatus(email);
            renderStatus({
              statusLineEl,
              isConnected: !!s.isConnected,
              lastSyncedAt: s.lastSyncedAt || null,
            });
          } catch (_) {}

          ordersBtn.disabled = false;
          ordersBtn.textContent = originalText;
        } catch (err) {
          console.error('eBay orders frontend error', err);
          showNotification('error', err?.message || 'Tekniskt fel när vi hämtade eBay-ordrar.', statusElId);
          ordersBtn.disabled = false;
          ordersBtn.textContent = 'Hämta eBay-ordrar';
        }
      });
    }
  } catch (err) {
    console.error('initEbaySection error', err);
  }
}
