// backend/services/ebayTokenService.js
// Hämtar eBay-token från DB, dekrypterar, refresh:ar vid behov, uppdaterar DB.

const https = require('https');
const querystring = require('querystring');
const { PrismaClient } = require('@prisma/client');
const { decryptSecret, encryptSecret } = require('./secretService');

const prisma = new PrismaClient();

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_ENV = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase();

const EBAY_TOKEN_HOST =
  EBAY_ENV === 'SANDBOX' ? 'api.sandbox.ebay.com' : 'api.ebay.com';

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
              new Error(`eBay refresh failed (${status}): ${data?.slice(0, 500)}`)
            );
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Kunde inte tolka JSON från eBay refresh-endpoint'));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function assertEnv() {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    throw new Error('EBAY_CLIENT_ID/EBAY_CLIENT_SECRET saknas i env');
  }
}

/**
 * Refresh access token med refresh token.
 * eBay: POST https://api.ebay.com/identity/v1/oauth2/token
 */
async function refreshAccessToken({ refreshToken, scope }) {
  assertEnv();

  const basic = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`, 'utf8').toString('base64');

  const tokenJson = await httpPostForm({
    host: EBAY_TOKEN_HOST,
    path: '/identity/v1/oauth2/token',
    headers: {
      Authorization: `Basic ${basic}`,
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      // scope är ofta OK att skicka med (och bra om eBay kräver det)
      ...(scope ? { scope } : {}),
    },
  });

  return tokenJson;
}

/**
 * Returnerar ett giltigt access token för kundens eBay-profil.
 * - Om access token är giltigt: returnera det.
 * - Om access token saknas/utgånget: refresh:a, uppdatera DB, returnera nytt.
 */
async function getValidEbayAccessTokenByEmail(email) {
  const emailTrim = String(email || '').trim().toLowerCase();
  if (!emailTrim) throw new Error('Saknar email');

  const customer = await prisma.customer.findFirst({
    where: { OR: [{ subjectRef: emailTrim }, { email: emailTrim }] },
  });
  if (!customer) throw new Error('Kund hittades inte');

  const profile = await prisma.externalProfile.findFirst({
    where: { customerId: customer.id, platform: 'EBAY' },
    orderBy: { createdAt: 'desc' },
  });
  if (!profile) throw new Error('Ingen eBay-profil hittades för kunden (har du kört OAuth?)');

  // 1) Om vi har ett access token som inte gått ut -> använd det
  const accessToken = profile.accessTokenEnc ? decryptSecret(profile.accessTokenEnc) : null;
  const refreshToken = profile.refreshTokenEnc ? decryptSecret(profile.refreshTokenEnc) : null;

  const now = new Date();
  const expiresAt = profile.accessTokenExpiresAt ? new Date(profile.accessTokenExpiresAt) : null;

  // “säkerhetsmarginal”: refresh:a om mindre än 60s kvar
  const stillValid =
    accessToken &&
    expiresAt &&
    expiresAt.getTime() - now.getTime() > 60 * 1000;

  if (stillValid) {
    return { customerId: customer.id, externalProfileId: profile.id, accessToken };
  }

  // 2) Annars måste vi refresh:a
  if (!refreshToken) {
    throw new Error('Saknar refresh token i DB för eBay-profilen (kör OAuth igen)');
  }

  const refreshed = await refreshAccessToken({
    refreshToken,
    scope: profile.scopes || undefined,
  });

  const newAccessToken = refreshed.access_token || null;
  if (!newAccessToken) throw new Error('Refresh lyckades men ingen access_token returnerades');

  const expiresIn = typeof refreshed.expires_in === 'number' ? refreshed.expires_in : null;
  const newExpiresAt = expiresIn ? new Date(now.getTime() + expiresIn * 1000) : null;

  // ibland skickar eBay inte tillbaka refresh_token vid refresh, så vi behåller den gamla om den saknas
  const newRefreshToken = refreshed.refresh_token || null;
  const refreshTokenExpiresIn =
    typeof refreshed.refresh_token_expires_in === 'number'
      ? refreshed.refresh_token_expires_in
      : null;
  const newRefreshExpiresAt = refreshTokenExpiresIn
    ? new Date(now.getTime() + refreshTokenExpiresIn * 1000)
    : profile.refreshTokenExpiresAt || null;

  await prisma.externalProfile.update({
    where: { id: profile.id },
    data: {
      accessTokenEnc: encryptSecret(newAccessToken),
      accessTokenExpiresAt: newExpiresAt,
      // uppdatera refresh om vi fick en ny, annars behåll befintlig
      ...(newRefreshToken
        ? { refreshTokenEnc: encryptSecret(newRefreshToken) }
        : {}),
      refreshTokenExpiresAt: newRefreshExpiresAt,
      tokenType: refreshed.token_type || profile.tokenType || null,
      scopes: refreshed.scope || profile.scopes || null,
      updatedAt: new Date(),
    },
  });

  return { customerId: customer.id, externalProfileId: profile.id, accessToken: newAccessToken };
}

module.exports = {
  getValidEbayAccessTokenByEmail,
};
