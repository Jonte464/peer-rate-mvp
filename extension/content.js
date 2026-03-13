// extension/content.js
// MINIMAL VERSION
// Endast ansvar:
// 1) känna igen Tradera order-sida
// 2) lägga en knapp
// 3) öppna PeerRate med payload i hash direkt
//
// Ingen service worker
// Ingen backend-check
// Ingen bridge
// Ingen chrome.runtime.sendMessage

(function () {
  const BTN_ID = 'peerrate-float-btn-minimal';

  function log(...args) {
    try {
      console.log('[PeerRate minimal]', ...args);
    } catch {}
  }

  function normalizeText(v) {
    return String(v || '').replace(/\u00A0/g, ' ').trim();
  }

  function isRelevantTraderaOrderPage() {
    const url = location.href.toLowerCase();
    return url.includes('tradera.') && url.includes('/my/order/');
  }

  function getOrderIdFromUrl() {
    const m = location.pathname.match(/\/my\/order\/([^/?#]+)/i);
    return m && m[1] ? String(m[1]).trim() : '';
  }

  function getBodyText() {
    return String(document.body?.innerText || '').replace(/\u00A0/g, ' ');
  }

  function findFirstEmail(text) {
    const matches = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return matches.length ? normalizeText(matches[0]).toLowerCase() : '';
  }

  function extractOrderNumberFromText(text) {
    const m = String(text || '').match(/Ordernr\.?\s*([0-9 ]{4,})/i);
    return m && m[1] ? m[1].replace(/\s+/g, '') : '';
  }

  function extractItemNumberFromText(text) {
    const m = String(text || '').match(/Objektnr\s*([0-9 ]{4,})/i);
    return m && m[1] ? m[1].replace(/\s+/g, '') : '';
  }

  function buildMinimalPayload() {
    const bodyText = getBodyText();

    const orderIdFromText = extractOrderNumberFromText(bodyText);
    const orderIdFromUrl = getOrderIdFromUrl();
    const orderId = orderIdFromText || orderIdFromUrl || '';

    const itemId = extractItemNumberFromText(bodyText);
    const firstEmail = findFirstEmail(bodyText);

    const payload = {
      source: 'Tradera',
      pageUrl: location.href,
      proofRef: orderId || location.href,
      subjectEmail: firstEmail || '',
      counterparty: {
        email: firstEmail || '',
        platform: 'TRADERA',
        orderId: orderId || '',
        itemId: itemId || '',
        pageUrl: location.href
      },
      deal: {
        platform: 'TRADERA',
        orderId: orderId || '',
        itemId: itemId || '',
        pageUrl: location.href
      }
    };

    return payload;
  }

  function encodePayload(payload) {
    const json = JSON.stringify(payload || {});
    return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
  }

  function buildRateUrl(payload) {
    return `https://peerrate.ai/rate.html#pr=${encodePayload(payload)}`;
  }

  function openRatePage() {
    const payload = buildMinimalPayload();
    const url = buildRateUrl(payload);

    log('Opening rate page with payload', payload);
    log('Opening URL', url);

    window.open(url, '_blank', 'noopener');
  }

  function ensureButton() {
    if (!isRelevantTraderaOrderPage()) {
      const oldBtn = document.getElementById(BTN_ID);
      if (oldBtn) oldBtn.remove();
      return;
    }

    let btn = document.getElementById(BTN_ID);
    if (btn) return;

    btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = 'Betygsätt med PeerRate';

    Object.assign(btn.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: '999999',
      background: 'linear-gradient(135deg, #0b1f3b, #132f55)',
      color: '#ffffff',
      padding: '14px 18px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.15)',
      fontSize: '14px',
      fontWeight: '700',
      letterSpacing: '0.2px',
      cursor: 'pointer',
      boxShadow: '0 16px 40px rgba(0,0,0,0.45)'
    });

    btn.addEventListener('click', openRatePage);
    document.documentElement.appendChild(btn);

    log('Minimal button injected');
  }

  function start() {
    ensureButton();

    const observer = new MutationObserver(() => {
      ensureButton();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        ensureButton();
      }
    }, 500);
  }

  start();
})();