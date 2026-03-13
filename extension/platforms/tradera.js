// extension/platforms/tradera.js
(function () {
  const shared = window.PeerRateShared || {};
  const dom = shared.dom || {};

  function normalizeText(value) {
    if (typeof dom.normalizeText === 'function') {
      return dom.normalizeText(value);
    }
    return String(value || '').replace(/\u00A0/g, ' ').trim();
  }

  function getBodyText() {
    if (typeof dom.getBodyText === 'function') {
      return dom.getBodyText();
    }
    return String(document.body?.innerText || '').replace(/\u00A0/g, ' ');
  }

  function findFirstEmail(text) {
    if (typeof dom.findFirstEmail === 'function') {
      return dom.findFirstEmail(text);
    }
    const matches =
      String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return matches.length ? normalizeText(matches[0]).toLowerCase() : '';
  }

  function isRelevantTraderaOrderPage() {
    const url = location.href.toLowerCase();
    return url.includes('tradera.') && url.includes('/my/order/');
  }

  function getOrderIdFromUrl() {
    const match = location.pathname.match(/\/my\/order\/([^/?#]+)/i);
    return match && match[1] ? String(match[1]).trim() : '';
  }

  function extractOrderNumberFromText(text) {
    const match = String(text || '').match(/Ordernr\.?\s*([0-9 ]{4,})/i);
    return match && match[1] ? match[1].replace(/\s+/g, '') : '';
  }

  function extractItemNumberFromText(text) {
    const match = String(text || '').match(/Objektnr\s*([0-9 ]{4,})/i);
    return match && match[1] ? match[1].replace(/\s+/g, '') : '';
  }

  function buildPayload() {
    const bodyText = getBodyText();

    const orderIdFromText = extractOrderNumberFromText(bodyText);
    const orderIdFromUrl = getOrderIdFromUrl();
    const orderId = orderIdFromText || orderIdFromUrl || '';

    const itemId = extractItemNumberFromText(bodyText);
    const firstEmail = findFirstEmail(bodyText);

    return {
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
  }

  const traderaAdapter = {
    id: 'tradera',
    label: 'Betygsätt med PeerRate',
    matches() {
      return isRelevantTraderaOrderPage();
    },
    buildPayload
  };

  window.PeerRatePlatforms = window.PeerRatePlatforms || {};
  window.PeerRatePlatforms.tradera = traderaAdapter;
})();