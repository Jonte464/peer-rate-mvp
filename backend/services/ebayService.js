// backend/services/ebayService.js
// Bygger eBay OAuth-URL och tolkar callback-state (MVP: inget riktigt token-utbyte ännu)

const querystring = require('querystring');

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI;
const EBAY_ENV = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase();

const EBAY_AUTH_BASE =
  EBAY_ENV === 'SANDBOX'
    ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
    : 'https://auth.ebay.com/oauth2/authorize';

// Vilka scopes vi ber om – kan justeras senare
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/buy.order.readonly',
];

function buildEbayAuthUrlForCustomer(customerId) {
  if (!EBAY_CLIENT_ID || !EBAY_REDIRECT_URI) {
    throw new Error('EBAY_CLIENT_ID eller EBAY_REDIRECT_URI saknas i env');
  }

  const statePayload = JSON.stringify({
    customerId,
    ts: Date.now(),
  });

  const state = Buffer.from(statePayload, 'utf8').toString('base64');

  const qs = querystring.stringify({
    response_type: 'code',
    client_id: EBAY_CLIENT_ID,
    redirect_uri: EBAY_REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
  });

  const redirectUrl = `${EBAY_AUTH_BASE}?${qs}`;

  return { redirectUrl, state };
}

function handleEbayCallback({ code, state }) {
  let decoded = null;

  try {
    const json = Buffer.from(state, 'base64').toString('utf8');
    decoded = JSON.parse(json);
  } catch (err) {
    throw new Error('Ogiltigt state-värde i eBay-callback');
  }

  const customerId = decoded.customerId || null;
  const safeCodeSnippet = code ? code.slice(0, 10) + '...' : null;

  // MVP: ingen token-förfrågan ännu
  return {
    customerId,
    statePayload: decoded,
    codeSnippet: safeCodeSnippet,
    accessTokenSnippet: null,
    hasRefreshToken: false,
    expiresIn: 0,
  };
}

module.exports = {
  buildEbayAuthUrlForCustomer,
  handleEbayCallback,
};
