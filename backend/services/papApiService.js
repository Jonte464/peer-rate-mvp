// papApiService.js - enkla wrapper för PAP-API
// Använder global fetch i Node 20+, faller tillbaka om token saknas
const PAPAPI_BASE_URL = process.env.PAPAPI_BASE_URL || 'https://papapi.se/json/';
const PAPAPI_TOKEN = process.env.PAPAPI_TOKEN;

if (!PAPAPI_TOKEN) {
  console.warn('PAPAPI_TOKEN saknas – extern adressverifiering kommer inte fungera.');
}

/**
 * Lookup address via PAP API
 * @param {object} param0
 * @param {string} param0.street
 * @param {string} param0.number
 * @param {string} param0.zipcode
 * @param {string} param0.city
 */
async function lookupAddressWithPapApi({ street, number, zipcode, city } = {}) {
  if (!PAPAPI_TOKEN) return null;

  const parts = [street || '', number || '', (zipcode || '').replace(/\s+/g, ''), city || ''];

  const v = parts.map((p) => encodeURIComponent(String(p || ''))).join('|');

  const url = `${PAPAPI_BASE_URL}?v=${v}&token=${PAPAPI_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PAP-API error: ${res.status}`);
  }

  const data = await res.json();
  const result = data?.result;
  if (!result || !result.address) return null;

  const address = result.address || {};
  const status = result.status || {};

  return {
    street: address.street || null,
    number: address.number || null,
    zipcode: address.zipcode || null,
    city: address.city || null,
    statusCode: status.code || null,
    statusTextSv: status.description_sv || null,
    statusTextEn: status.description_en || null,
    raw: data,
  };
}

module.exports = { lookupAddressWithPapApi };
