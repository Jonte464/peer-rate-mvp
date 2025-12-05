// backend/services/traderaApiService.js
//
// Tradera SOAP API-klient för PublicService.
// Här skickar vi AppId och AppKey i SOAP-headern enligt dokumentationen.

const soap = require('soap');

// Läs API-nycklar från .env
const APP_ID = Number(process.env.TRADERA_APP_ID || 0);
const APP_KEY = process.env.TRADERA_APP_KEY;
const SANDBOX = Number(process.env.TRADERA_SANDBOX || 0);

// WSDL-URL för PublicService
const WSDL_URL = 'https://api.tradera.com/v3/PublicService.asmx?wsdl';

// Säkerställ att vi har nödvändig konfiguration
function ensureConfig() {
  if (!APP_ID || !APP_KEY) {
    throw new Error(
      'Tradera API-konfiguration saknas: kontrollera TRADERA_APP_ID och TRADERA_APP_KEY i .env'
    );
  }
}

// Skapa SOAP-klient och lägg på AuthenticationHeader + ConfigurationHeader
async function getSoapClient() {
  ensureConfig();

  const client = await soap.createClientAsync(WSDL_URL);

  // Enligt dokumentationen ska headers se ut så här:
  // <AuthenticationHeader xmlns="http://api.tradera.com">
  //   <AppId>int</AppId>
  //   <AppKey>string</AppKey>
  // </AuthenticationHeader>
  // <ConfigurationHeader xmlns="http://api.tradera.com">
  //   <Sandbox>int</Sandbox>
  // </ConfigurationHeader>

  const headers = {
    AuthenticationHeader: {
      AppId: APP_ID,
      AppKey: APP_KEY,
    },
    ConfigurationHeader: {
      Sandbox: SANDBOX,
    },
  };

  // Lägg till SOAP-header med rätt namespace
  client.addSoapHeader(headers, '', '', 'http://api.tradera.com');

  return client;
}

// Testfunktion – anropar GetCategories (kräver bara appId/appKey)
async function testApiConnection() {
  try {
    const client = await getSoapClient();

    // GetCategories tar inga parametrar
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
