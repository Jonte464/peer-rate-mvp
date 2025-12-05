// backend/services/traderaApiService.js
//
// Grund för att prata med Tradera SOAP API.
// När Tradera aktiverar dina metoder (GetSellerOrders, GetBuyerTransactions)
// fyller vi på denna fil med riktiga SOAP-anrop.

const soap = require('soap');

// Läs API-nycklar från .env
const APP_ID = process.env.TRADERA_APP_ID;
const APP_KEY = process.env.TRADERA_APP_KEY;
const PUBLIC_KEY = process.env.TRADERA_PUBLIC_KEY;

// Bas-URL för Traderas API (V3)
const TRADERA_WSDL_URL =
  'https://api.tradera.com/v3/PublicService.asmx?wsdl';

// Hjälpfunktion för att skapa SOAP-klient
async function getSoapClient() {
  try {
    const client = await soap.createClientAsync(TRADERA_WSDL_URL);
    return client;
  } catch (err) {
    console.error('❌ Tradera SOAP client creation failed:', err);
    throw err;
  }
}

// Testfunktion – bara för att verifiera att API:t går att nå
async function testApiConnection() {
  const client = await getSoapClient();

  // Alla SOAP-anrop kräver ett argumentobjekt – denna metod kräver ingen auth
  const args = {};

  try {
    const [result] = await client.GetCategoriesAsync(args);
    console.log('✅ Tradera API anslutning OK (GetCategories fungerar)');
    return result;
  } catch (err) {
    console.error('❌ Testanrop misslyckades:', err);
    throw err;
  }
}

module.exports = {
  testApiConnection,
  getSoapClient,
};
