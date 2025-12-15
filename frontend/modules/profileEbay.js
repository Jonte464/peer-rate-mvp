// frontend/modules/profileEbay.js
// Hanterar eBay-kopplingen + visar eBay-ordrar på "Min profil"

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

function formatDate(iso) {
  if (!iso) return '–';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
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

  // Visa enkel lista (orderId + datum + status + amount om möjligt)
  const rows = orders.map((o) => {
    const orderId = safeText(o?.orderId || o?.order_id || o?.id);
    const created = formatDate(o?.creationDate || o?.creation_date || o?.createdDate);
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
 * Initierar eBay-sektionen om rätt element finns i DOM.
 * Förväntar sig:
 *  - Knapp id="ebay-connect-btn"
 *  - Knapp id="ebay-orders-btn"
 *  - Status-element id="ebay-status"
 *  - Lista id="ebay-orders-list"
 */
export async function initEbaySection() {
  try {
    const connectBtn = document.getElementById('ebay-connect-btn');
    const ordersBtn = document.getElementById('ebay-orders-btn');
    const statusElId = 'ebay-status';
    const ordersList = document.getElementById('ebay-orders-list');

    // Om eBay-kortet inte finns på sidan → gör inget
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
      return;
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

          // Redirect till eBay consent/login
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

          // OBS: den här endpointen finns redan och funkar nu
          const resp = await fetch(`/api/ebay/orders?email=${encodeURIComponent(email)}`);
          const json = await resp.json().catch(() => null);

          if (!resp.ok || !json || json.ok === false) {
            const msg =
              (json && (json.error || json.message)) ||
              `Kunde inte hämta eBay-ordrar (HTTP ${resp.status}).`;
            showNotification('error', msg, statusElId);
            ordersBtn.disabled = false;
            ordersBtn.textContent = originalText;
            return;
          }

          // Rendera "data" från backend
          renderOrders(ordersList, json.data);

          showNotification('success', 'eBay-ordrar uppdaterade.', statusElId);
          ordersBtn.disabled = false;
          ordersBtn.textContent = originalText;
        } catch (err) {
          console.error('eBay orders frontend error', err);
          showNotification(
            'error',
            'Tekniskt fel när vi hämtade eBay-ordrar.',
            statusElId
          );
          ordersBtn.disabled = false;
          ordersBtn.textContent = 'Hämta eBay-ordrar';
        }
      });
    }
  } catch (err) {
    console.error('initEbaySection error', err);
  }
}
