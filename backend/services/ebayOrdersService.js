// backend/services/ebayOrdersService.js
// Hämtar eBay-ordrar med ett giltigt User Access Token
// Stödjer både:
//  - BUY  -> /buy/order/v1/order
//  - SELL -> /sell/fulfillment/v1/order
//
// Förbättringar i denna version:
//  - Robust feltext (försöker läsa eBays error-format)
//  - Default = SELL (passar din “säljarsidan/fulfillment”)
//  - En enkel fallback: om SELL ger 404 så testar vi BUY automatiskt (valbart via autoFallback)

const EBAY_ENV = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase();

const EBAY_API_BASE =
  EBAY_ENV === 'SANDBOX'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

function extractEbayError(text, json, status) {
  // eBay svarar ibland med errors:[{message, longMessage, errorId, parameters...}]
  if (json && typeof json === 'object') {
    if (Array.isArray(json.errors) && json.errors.length) {
      const e = json.errors[0] || {};
      const msg = e.longMessage || e.message || e.error || null;
      if (msg) return msg;
    }
    if (json.message) return json.message;
    if (json.error_description) return json.error_description;
    if (json.error) return json.error;
  }
  return text || `HTTP ${status}`;
}

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
  try {
    json = JSON.parse(text);
  } catch (_) {}

  if (!resp.ok) {
    const msg = extractEbayError(text, json, resp.status);
    const err = new Error(`eBay API error: ${msg}`);
    err.status = resp.status;
    err.body = json || text;
    throw err;
  }

  return json;
}

function buildOrdersUrl({ mode, limit, offset }) {
  const m = String(mode || 'SELL').toUpperCase();
  const safeMode = m === 'BUY' ? 'BUY' : 'SELL';

  const path =
    safeMode === 'SELL'
      ? '/sell/fulfillment/v1/order'
      : '/buy/order/v1/order';

  const url = new URL(`${EBAY_API_BASE}${path}`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return { url: url.toString(), safeMode };
}

/**
 * mode: 'BUY' | 'SELL'
 * autoFallback: om true -> om SELL ger 404 testar vi BUY automatiskt (och vice versa)
 */
async function fetchEbayOrders({
  accessToken,
  mode = 'SELL',
  limit = 50,
  offset = 0,
  autoFallback = true,
}) {
  if (!accessToken) throw new Error('Saknar accessToken');

  const primary = buildOrdersUrl({ mode, limit, offset });

  try {
    return await fetchJson(primary.url, accessToken);
  } catch (err) {
    // Fallback vid 404 (ofta pga fel “side” / scopes / endpoint för kontot)
    if (autoFallback && err && err.status === 404) {
      const fallbackMode = primary.safeMode === 'SELL' ? 'BUY' : 'SELL';
      const secondary = buildOrdersUrl({ mode: fallbackMode, limit, offset });
      return await fetchJson(secondary.url, accessToken);
    }
    throw err;
  }
}

module.exports = { fetchEbayOrders };
