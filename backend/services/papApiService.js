// backend/services/papApiService.js
// PAP/API Lite-integration (postnummer + gata/postort)

const BASE_URL =
  process.env.PAPAPI_BASE_URL || 'https://api.papapi.se/lite/';
const API_KEY =
  process.env.PAPAPI_TOKEN || process.env.PAPAPI_API_KEY || null;

/**
 * Normalisera postnummer: ta bara siffror, använd 5-siffrigt om det finns.
 */
function normalizeZip(zip) {
  if (!zip) return null;
  const digits = String(zip).replace(/\D/g, '');
  if (digits.length === 5) return digits;
  if (digits.length >= 3) return digits; // PAP/API Lite tillåter 3+ siffror
  return null;
}

/**
 * Bygger "query" för PAP/API Lite:
 * - i första hand postnummer (snabbt & säkert)
 * - annars GATA|POSTORT om både gata & ort finns
 * - annars bara postort
 */
function buildLiteQuery({ street, number, zipcode, city }) {
  const z = normalizeZip(zipcode);
  if (z) {
    return { type: 'zip', query: z };
  }

  const s = street && String(street).trim();
  const c = city && String(city).trim();

  if (s && c) {
    // GATA|POSTORT enligt dokumentationen
    return { type: 'street_city', query: `${s}|${c}` };
  }

  if (c) {
    return { type: 'city', query: c };
  }

  if (s) {
    return { type: 'street', query: s };
  }

  return null;
}

/**
 * Anropa PAP/API Lite och försök validera adressen.
 *
 * @param {Object} addr
 *   - street: t.ex. "Kastanjebacken"
 *   - number: t.ex. "10"
 *   - zipcode: t.ex. "18539"
 *   - city: t.ex. "Vaxholm"
 *
 * Returnerar antingen:
 *   null  -> ingen extern data / inget svar
 *   eller ett objekt:
 *   {
 *     street,
 *     number,
 *     zipcode,
 *     city,
 *     statusCode: 'FOUND',
 *     statusTextSv,
 *     statusTextEn,
 *     source,
 *     updated,
 *     raw      // hela svaret från PAP/API Lite (för loggning / felsökning)
 *   }
 */
async function lookupAddressWithPapApi(addr = {}) {
  if (!API_KEY) {
    console.warn(
      '[PAPAPI] Ingen API-nyckel satt (PAPAPI_TOKEN). Hoppar över extern adresskontroll.'
    );
    return null;
  }

  const q = buildLiteQuery(addr);
  if (!q) {
    console.warn('[PAPAPI] Saknar tillräcklig adressdata för att bygga query.');
    return null;
  }

  try {
    const url = new URL(BASE_URL);
    url.searchParams.set('query', q.query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('apikey', API_KEY);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(
        '[PAPAPI] HTTP-fel från PAP/API Lite:',
        res.status,
        text?.slice(0, 300)
      );

      // 404 = inget svar (vi behandlar som "ingen extern data")
      if (res.status === 404) return null;
      return null;
    }

    const data = await res.json().catch((err) => {
      console.error('[PAPAPI] Kunde inte parsa JSON från PAP/API Lite:', err);
      return null;
    });

    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
      // Korrekt anrop men ingen träff → ingen extern data
      return null;
    }

    const first = data.results[0];

    const streetFromApi =
      Array.isArray(first.streets) && first.streets.length
        ? first.streets[0]
        : null;

    const result = {
      street: streetFromApi || addr.street || null,
      number: addr.number || null,
      zipcode: first.postal_code || normalizeZip(addr.zipcode),
      city: first.city || addr.city || null,
      statusCode: 'FOUND',
      statusTextSv: 'Adress hittades i PAP/API Lite',
      statusTextEn: 'Address found in PAP/API Lite',
      source: 'PAPAPI_LITE',
      updated:
        first.updated ||
        (data.api && data.api.updated) ||
        new Date().toISOString(),
      raw: data,
    };

    return result;
  } catch (err) {
    console.error('[PAPAPI] Tekniskt fel vid uppslag mot PAP/API Lite:', err);
    // Vid tekniskt fel: returnera null -> frontend gömmer fältet
    return null;
  }
}

module.exports = {
  lookupAddressWithPapApi,
};
