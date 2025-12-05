// backend/services/traderaApiService.js
//
// Grund för att prata med Tradera SOAP API.
// Här sätter vi upp klienten så att AppId och AppKey alltid skickas med.

const soap = require('soap');

// Läs API-nycklar från .env
const APP_ID = Number(process.env.TRADERA_APP_ID || 0);
const APP_KEY = process.env.TRADERA_APP_KEY;
const PUBLIC_KEY = process.env.TRADERA_PUBLIC_KEY || null;
const SANDBOX = Number(process.env.TRADERA_SANDBOX || 0);

// WSDL och bas-URL för PublicService
const WSDL_URL = 'https://api.tradera.com/v3/PublicService.asmx?wsdl';
const SERVICE_ENDPOINT_BASE = 'https://api.tradera.com/v3/PublicService.asmx';

// Säkerställ att vi har nödvändig konfiguration
function ensureConfig() {
  if (!APP_ID || !APP_KEY) {
    throw new Error(
      'Tradera API-konfiguration saknas: kontrollera TRADERA_APP_ID och TRADERA_APP_KEY i .env'
    );
  }
}

// Skapa SOAP-klient med rätt endpoint (inkl. appId & appKey i querystring)
async function getSoapClient() {
  ensureConfig();

  // Skapa klient från WSDL
  const client = await soap.createClientAsync(WSDL_URL);

  // Sätt endpoint så att appId, appKey och sandbox skickas som query-parametrar
  const endpoint =
    SERVICE_ENDPOINT_BASE +
    `?appId=${encodeURIComponent(APP_ID)}&appKey=${encodeURIComponent(
      APP_KEY
    )}&sandbox=${SANDBOX}`;

  client.setEndpoint(endpoint);

  return client;
}

// Enkel testfunktion – anropar GetCategories
async function testApiConnection() {
  try {
    const client = await getSoapClient();

    // GetCategories tar inga parametrar enligt dokumentationen
    const [result] = await client.GetCategoriesAsync({});

    console.log('✅ Tradera API test OK (GetCategories)');
    return result;
  } catch (err) {
    console.error('❌ Tradera API test error:', err);
    throw err;
  }
}

module.exports = {
  getSoapClient,
  testApiConnection,
};
