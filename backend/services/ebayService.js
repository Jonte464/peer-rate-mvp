// backend/services/ebayService.js
// Bygger eBay OAuth-URL + gör token-utbyte (authorization_code -> access/refresh)

const https = require('https');
const querystring = require('querystring');

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI;
const EBAY_ENV = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase();

const EBAY_AUTH_BASE =
  EBAY_ENV === 'SANDBOX'
    ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
    : 'https://auth.ebay.com/oauth2/authorize';

const EBAY_TOKEN_HOST =
  EBAY_ENV === 'SANDBOX' ? 'api.sandbox.ebay.com' : 'api.ebay.com';

/**
 * ✅ ENDA scopet vi får använda i Production just nu
 * (detta matchar exakt vad eBay säger att PeerRate är "granted")
 */
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
];

// ---------- base64url helpers ----------
function toBase64Url(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(b64url) {
  const b64 = String(b64url || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLen = (4 - (b64.length % 4)) % 4;
  return Buffer.from(b64 + '='.repeat(padLen), 'base64').toString('utf8');
}

function buildEbayAuthUrlForCustomer(customerId) {
  if (!EBAY_CLIENT_ID || !EBAY_REDIRECT_URI) {
    throw new Error('EBAY_CLIENT_ID eller EBAY_REDIRECT_URI saknas');
  }

  const state = toBase64Url(JSON.stringify({ customerId, ts: Date.now() }));

  const u = new URL(EBAY_AUTH_BASE);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', EBAY_CLIENT_ID);
  u.searchParams.set('redirect_uri', EBAY_REDIRECT_URI);
  u.searchParams.set('scope', SCOPES.join(' '));
  u.searchParams.set('state', state);

  return { redirectUrl: u.toString(), state };
}

function decodeState(state) {
  return JSON.parse(fromBase64Url(state));
}

async function exchangeCodeForTokens(code) {
  const basic = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`,
    'utf8'
  ).toString('base64');

  return new Promise((resolve, reject) => {
    const body = querystring.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: EBAY_REDIRECT_URI,
    });

    const req = https.request(
      {
        host: EBAY_TOKEN_HOST,
        path: '/identity/v1/oauth2/token',
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => resolve(JSON.parse(data)));
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function handleEbayCallback({ code, state }) {
  const decoded = decodeState(state);
  const token = await exchangeCodeForTokens(code);

  return {
    customerId: decoded.customerId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresIn: token.expires_in,
    tokenType: token.token_type,
    scopes: token.scope,
  };
}

module.exports = {
  buildEbayAuthUrlForCustomer,
  handleEbayCallback,
};
