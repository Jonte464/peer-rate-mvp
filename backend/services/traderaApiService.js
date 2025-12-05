// backend/services/traderaApiService.js
//
// Tradera SOAP API-klient för PublicService.
// Vi skickar AppId och AppKey i SOAP-headern enligt dokumentationen
// och har extra loggning för att se HTTP-status och ev. feltext.

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
    const [result, rawResponse, rawRequest, soapHeader] =
      await client.GetCategoriesAsync({});

    console.log('✅ Tradera API test OK (GetCategories)');
    // Logga lite meta för felsökning framöver
    console.log('Tradera rawResponse length:', rawResponse?.length || 0);
    return {
      result,
      meta: {
        hasRawResponse: !!rawResponse,
        hasRawRequest: !!rawRequest,
        hasSoapHeader: !!soapHeader,
      },
    };
  } catch (err) {
    // Här försöker vi plocka ut så mycket info som möjligt
    console.error('❌ Tradera API test error (full):', err);

    let httpStatus = null;
    let httpBody = null;

    // node-soap brukar lägga HTTP-responsen på err.response / err.body
    if (err && err.response && err.response.statusCode) {
      httpStatus = err.response.statusCode;
    }
    if (err && err.body) {
      httpBody = err.body;
    } else if (err && err.response && err.response.body) {
      httpBody = err.response.body;
    }

    // Begränsa längden så vi inte spränger loggarna
    if (typeof httpBody === 'string' && httpBody.length > 1000) {
      httpBody = httpBody.slice(0, 1000) + '... (truncated)';
    }

    const messageParts = ['Tradera API http error'];
    if (httpStatus) messageParts.push(`status=${httpStatus}`);
    if (httpBody) messageParts.push(`body=${httpBody}`);

    const wrapped = new Error(messageParts.join(' | '));
    wrapped.httpStatus = httpStatus;
    wrapped.httpBody = httpBody;

    throw wrapped;
  }
}

module.exports = {
  getSoapClient,
  testApiConnection,
};
