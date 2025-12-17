// backend/services/ebayService.js
// Bygger eBay OAuth-URL + gör token-utbyte (authorization_code -> access/refresh)

const querystring = require('querystring');
const https = require('https');

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

// Scopes (utökade så vi kan läsa ordrar både som säljare och köpare)
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/buy.order.readonly',
];


// ---------- base64url helpers (URL-säkra) ----------
function toBase64Url(str) {
  // base64 -> base64url (byt tecken + / och ta bort padding =)
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(b64url) {
  // base64url -> base64 (återställ tecken och padding)
  const b64 = String(b64url || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(padLen);

  return Buffer.from(padded, 'base64').toString('utf8');
}
// -----------------------------------------------

function buildEbayAuthUrlForCustomer(customerId) {
  if (!EBAY_CLIENT_ID || !EBAY_REDIRECT_URI) {
    throw new Error('EBAY_CLIENT_ID eller EBAY_REDIRECT_URI saknas i env');
  }

  const statePayload = JSON.stringify({ customerId, ts: Date.now() });
  const state = toBase64Url(statePayload);

  const qs = querystring.stringify({
    response_type: 'code',
    client_id: EBAY_CLIENT_ID,
    redirect_uri: EBAY_REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
  });

  return { redirectUrl: `${EBAY_AUTH_BASE}?${qs}`, state };
}

function decodeState(state) {
  try {
    const json = fromBase64Url(state);
    return JSON.parse(json);
  } catch {
    throw new Error('Ogiltigt state-värde i eBay-callback');
  }
}

function httpPostForm({ host, path, headers, form }) {
  return new Promise((resolve, reject) => {
    const body = querystring.stringify(form);

    const req = https.request(
      {
        host,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const status = res.statusCode || 0;
          if (status < 200 || status >= 300) {
            return reject(
              new Error(
                `eBay token request failed (${status}): ${data?.slice(0, 500)}`
              )
            );
          }

          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch {
            reject(new Error('Kunde inte tolka JSON från eBay token-endpoint'));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function exchangeCodeForTokens(code) {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REDIRECT_URI) {
    throw new Error(
      'EBAY_CLIENT_ID/EBAY_CLIENT_SECRET/EBAY_REDIRECT_URI saknas i env'
    );
  }

  const basic = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`,
    'utf8'
  ).toString('base64');

  const tokenJson = await httpPostForm({
    host: EBAY_TOKEN_HOST,
    path: '/identity/v1/oauth2/token',
    headers: {
      Authorization: `Basic ${basic}`,
    },
    form: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: EBAY_REDIRECT_URI,
    },
  });

  return tokenJson;
}

async function handleEbayCallback({ code, state }) {
  const decoded = decodeState(state);
  const customerId = decoded.customerId || null;

  const token = await exchangeCodeForTokens(code);

  const accessToken = token.access_token || '';
  const refreshToken = token.refresh_token || '';

  return {
    customerId,
    statePayload: decoded,
    scopes: token.scope || null,
    tokenType: token.token_type || null,
    expiresIn: token.expires_in || null,
    refreshTokenExpiresIn: token.refresh_token_expires_in || null,

    accessToken,
    refreshToken,

    accessTokenSnippet: accessToken ? accessToken.slice(0, 12) + '...' : null,
    refreshTokenSnippet: refreshToken ? refreshToken.slice(0, 12) + '...' : null,
    hasRefreshToken: !!refreshToken,
  };
}

module.exports = {
  buildEbayAuthUrlForCustomer,
  handleEbayCallback,
};
