// backend/services/ebayService.js
// eBay-integration (MVP-skelett)
// - Bygger OAuth-URL för att koppla ett eBay-konto
// - Håller en enkel in-memory "state store" för att koppla state -> customerId
// - Hanterar callback på ett grundläggande sätt (utan att hämta token ännu)

const crypto = require('crypto');
const querystring = require('querystring');

// Enkel in-memory store för OAuth-state
// OBS: För MVP räcker detta. I produktion med flera instanser / restarts
//      bör detta ersättas av lagring i t.ex. databasen.
const stateStore = new Map();

/**
 * Väljer auth-bas-URL beroende på EBAY_ENV
 * - SANDBOX: https://auth.sandbox.ebay.com/oauth2/authorize
 * - annars: https://auth.ebay.com/oauth2/authorize
 */
function getEbayAuthBaseUrl() {
  const env = String(process.env.EBAY_ENV || '').toUpperCase();
  if (env === 'SANDBOX') {
    return 'https://auth.sandbox.ebay.com/oauth2/authorize';
  }
  return 'https://auth.ebay.com/oauth2/authorize';
}

/**
 * Bygger scopes-sträng för eBay OAuth
 * Här väljer vi några rimliga scopes för att senare kunna läsa sälj-orderdata.
 * (Detta kan justeras när vi vet exakt vilka API:er vi använder.)
 */
function getEbayScopes() {
  const scopes = [
    // Bas-scope för eBay API
    'https://api.ebay.com/oauth/api_scope',
    // Läs access till Fulfillment (säljordrar) – kan justeras vid behov
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  ];
  return scopes.join(' ');
}

/**
 * Bygger en fullständig eBay OAuth-URL för en given customerId.
 * Returnerar: { redirectUrl }
 */
function buildEbayAuthUrlForCustomer(customerId) {
  const clientId = process.env.EBAY_CLIENT_ID;
  const redirectUri = process.env.EBAY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error(
      'EBAY_CLIENT_ID eller EBAY_REDIRECT_URI saknas. Kontrollera env-variabler.'
    );
    throw new Error(
      'eBay-integration är inte korrekt konfigurerad (saknar env-variabler).'
    );
  }

  // Skapa en slumpmässig state-sträng
  const state = crypto.randomBytes(16).toString('hex');

  // Spara koppling state -> customerId i memory-store
  stateStore.set(state, {
    customerId,
    createdAt: new Date(),
  });

  const baseUrl = getEbayAuthBaseUrl();
  const scope = getEbayScopes();

  const qs = querystring.stringify({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  });

  const redirectUrl = `${baseUrl}?${qs}`;

  return { redirectUrl };
}

/**
 * Rensar ut gamla state-poster som är för gamla (t.ex. > 30 minuter)
 * (en enkel housekeeping-funktion)
 */
function cleanupOldStates() {
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;

  for (const [state, info] of stateStore.entries()) {
    const createdAt = info && info.createdAt ? info.createdAt.getTime() : 0;
    if (!createdAt || now - createdAt > THIRTY_MINUTES) {
      stateStore.delete(state);
    }
  }
}

/**
 * Hanterar callback från eBay.
 * Input: { code, state }
 * Gör:
 *  - Verifierar att state finns i stateStore
 *  - Plockar fram customerId
 *  - Tar bort state från store
 *
 * Just nu:
 *  - Vi hämtar INTE access/refresh token ännu (görs i nästa steg).
 *  - Vi returnerar bara customerId och code så att vi vet att flödet fungerar.
 */
async function handleEbayCallback({ code, state }) {
  if (!code || !state) {
    throw new Error('Saknar code eller state i eBay-callback.');
  }

  // Städa gamla states innan vi använder
  cleanupOldStates();

  const entry = stateStore.get(state);
  if (!entry || !entry.customerId) {
    throw new Error('Ogiltigt eller föråldrat state i eBay-callback.');
  }

  const { customerId } = entry;
  // Ta bort state så det inte kan återanvändas
  stateStore.delete(state);

  // TODO (nästa steg):
  //  - Byta "code" mot access/refresh token via eBays token-endpoint
  //  - Kryptera och lagra tokens i databasen kopplat till customerId
  //  - Kanske skapa/uppdatera en externalProfile-post med platform: 'EBAY'

  return {
    customerId,
    code,
  };
}

module.exports = {
  buildEbayAuthUrlForCustomer,
  handleEbayCallback,
};
