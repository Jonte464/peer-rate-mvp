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

// Token-endpoint (Identity API)
const EBAY_TOKEN_HOST =
  EBAY_ENV === 'SANDBOX' ? 'api.sandbox.ebay.com' : 'api.ebay.com';

// Scopes (kan utökas senare)
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/buy.order.readonly',
];

function buildEbayAuthUrlForCustomer(customerId) {
  if (!EBAY_CLIENT_ID || !EBAY_REDIRECT_URI) {
    throw new Error('EBAY_CLIENT_ID eller EBAY_REDIRECT_URI saknas i env');
  }

  const statePayload = JSON.stringify({ customerId, ts: Date.now() });
  const state = Buffer.from(statePayload, 'utf8').toString('base64');

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
    const json = Buffer.from(state, 'base64').toString('utf8');
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
          } catch (e) {
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
    throw new Error('EBAY_CLIENT_ID/EBAY_CLIENT_SECRET/EBAY_REDIRECT_URI saknas i env');
  }

  const basic = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`, 'utf8').toString('base64');

  // eBay: POST https://api.ebay.com/identity/v1/oauth2/token
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

  // Token-utbyte
  const token = await exchangeCodeForTokens(code);

  // Vi returnerar "snippets" så du kan verifiera utan att vi råkar logga tokens överallt.
  const accessToken = token.access_token || '';
  const refreshToken = token.refresh_token || '';

  return {
    customerId,
    statePayload: decoded,
    scopes: token.scope || null,
    tokenType: token.token_type || null,
    expiresIn: token.expires_in || null,
    refreshTokenExpiresIn: token.refresh_token_expires_in || null,
    accessTokenSnippet: accessToken ? accessToken.slice(0, 12) + '...' : null,
    refreshTokenSnippet: refreshToken ? refreshToken.slice(0, 12) + '...' : null,
    hasRefreshToken: !!refreshToken,
    // OBS: vi sparar i DB i nästa steg (så vi kan verifiera först)
  };
}

module.exports = {
  buildEbayAuthUrlForCustomer,
  handleEbayCallback,
};
