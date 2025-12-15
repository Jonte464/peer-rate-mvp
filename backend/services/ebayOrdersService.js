// backend/services/ebayOrdersService.js
// Hämtar eBay-ordrar med ett giltigt User Access Token
// Stödjer både:
//  - BUY  -> /buy/order/v1/order
//  - SELL -> /sell/fulfillment/v1/order

const EBAY_ENV = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase();

const EBAY_API_BASE =
  EBAY_ENV === 'SANDBOX'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

async function fetchJson(url, accessToken) {
  const resp = await fetch(url, {
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
    const msg =
      (json && (json.message || json.error_description || json.error)) ||
      text ||
      `HTTP ${resp.status}`;
    throw new Error(`eBay API error: ${msg}`);
  }

  return json;
}

/**
 * mode: 'BUY' | 'SELL'
 */
async function fetchEbayOrders({ accessToken, mode = 'BUY', limit = 50, offset = 0 }) {
  if (!accessToken) throw new Error('Saknar accessToken');

  const m = String(mode || 'BUY').toUpperCase();

  const path =
    m === 'SELL'
      ? '/sell/fulfillment/v1/order'
      : '/buy/order/v1/order';

  const url = new URL(`${EBAY_API_BASE}${path}`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  return fetchJson(url.toString(), accessToken);
}

module.exports = { fetchEbayOrders };
