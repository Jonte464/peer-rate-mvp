// backend/services/ebayOrdersService.js
// Hämtar eBay-ordrar via Sell Fulfillment API (säljarsidan)

const EBAY_ENV = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase();

const EBAY_API_BASE =
  EBAY_ENV === 'SANDBOX'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

// Sell Fulfillment: GET /sell/fulfillment/v1/order
async function fetchEbayOrders({ accessToken, limit = 50, offset = 0 }) {
  if (!accessToken) throw new Error('Saknar accessToken');

  const url = new URL(`${EBAY_API_BASE}/sell/fulfillment/v1/order`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const resp = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}

  if (!resp.ok) {
    // försök ge bättre fel än bara "HTTP 404"
    const msg =
      (json && (json.message || json.error_description || json.error)) ||
      (text ? text.slice(0, 500) : null) ||
      `HTTP ${resp.status}`;
    throw new Error(`eBay orders API error: ${msg}`);
  }

  return json;
}

module.exports = { fetchEbayOrders };
