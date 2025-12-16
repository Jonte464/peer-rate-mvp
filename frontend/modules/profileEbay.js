// frontend/modules/profileEbay.js
// Hanterar eBay-kopplingen + visar eBay-ordrar på "Min profil"
// Viktigt: eBay login/consent får ofta INTE visas i iframe (Wix). Vi öppnar därför i ny flik vid behov.

import { showNotification } from './utils.js';
import auth from './auth.js';

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

function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    // Om browsern blockerar access till window.top → vi antar att vi är i iframe
    return true;
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
    const created = formatDate(o?.creationDate || o?.creation_date || o?.createdDate);
    const status = safeText(o?.orderStatus || o?.order_status || o?.status);

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

export async function initEbaySection() {
  try {
    const connectBtn = document.getElementById('ebay-connect-btn');
    const ordersBtn = document.getElementById('ebay-orders-btn');
    const ordersList = document.getElementById('ebay-orders-list');
    const statusElId = 'ebay-status';

    if (!connectBtn && !ordersBtn) return;

    const email = getCurrentUserEmail();

    // Standard: enable (vi styr sen om vi saknar email)
    if (connectBtn) connectBtn.disabled = false;
    if (ordersBtn) ordersBtn.disabled = false;

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
        const originalText = connectBtn.textContent;
        try {
          connectBtn.disabled = true;
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

          const url = data.redirectUrl;

          // VIKTIGT: Om vi kör i Wix/iframe → öppna i ny flik (eBay blockerar ofta iframe)
          if (isInIframe()) {
            window.open(url, '_blank', 'noopener,noreferrer');
            showNotification(
              'success',
              'eBay öppnades i en ny flik. Slutför kopplingen där och kom sedan tillbaka hit.',
              statusElId
            );
            connectBtn.disabled = false;
            connectBtn.textContent = originalText;
            return;
          }

          // Annars kan vi navigera direkt
          window.location.href = url;
        } catch (err) {
          console.error('eBay connect frontend error', err);
          showNotification(
            'error',
            'Tekniskt fel vid eBay-koppling. Försök igen om en stund.',
            statusElId
          );
          connectBtn.disabled = false;
          connectBtn.textContent = originalText;
        }
      });
    }

    // ---------- HÄMTA ORDERS ----------
    if (ordersBtn && !ordersBtn._ebayOrdersBound) {
      ordersBtn._ebayOrdersBound = true;

      if (!ordersBtn.textContent || ordersBtn.textContent.trim() === '') {
        ordersBtn.textContent = 'Hämta eBay-ordrar';
      }

      ordersBtn.addEventListener('click', async () => {
        const originalText = ordersBtn.textContent;
        try {
          ordersBtn.disabled = true;
          ordersBtn.textContent = 'Hämtar eBay-ordrar...';

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

          renderOrders(ordersList, json.data);
          showNotification('success', 'eBay-ordrar uppdaterade.', statusElId);

          ordersBtn.disabled = false;
          ordersBtn.textContent = originalText;
        } catch (err) {
          console.error('eBay orders frontend error', err);
          showNotification('error', 'Tekniskt fel när vi hämtade eBay-ordrar.', statusElId);
          ordersBtn.disabled = false;
          ordersBtn.textContent = originalText;
        }
      });
    }
  } catch (err) {
    console.error('initEbaySection error', err);
  }
}
