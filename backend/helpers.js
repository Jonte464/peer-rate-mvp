// backend/helpers.js

// Aktuell tid i ISO-format
function nowIso() {
  return new Date().toISOString();
}

// Normalisera "subject" (t.ex. e-post) – trimma + lowercase
function normSubject(s) {
  return String(s || '').trim().toLowerCase();
}

// Trimma sträng, returnera null om tom
function clean(s) {
  if (s === undefined || s === null) return null;
  const trimmed = String(s).trim();
  return trimmed === '' ? null : trimmed;
}

// Normalisera telefonnummer (behåll bara siffror och +)
function normalizePhone(s) {
  const v = clean(s);
  if (!v) return null;
  const stripped = v.replace(/[^0-9+]/g, '');
  return stripped || null;
}

// Normalisera checkboxvärden från formulär
function normalizeCheckbox(v) {
  return v === true || v === 'true' || v === 'on' || v === '1';
}

// Validera svenskt personnummer (YYYYMMDDNNNN eller YYMMDDNNNN)
function isValidPersonalNumber(input) {
  if (!input) return false;
  const raw = String(input).replace(/[^0-9]/g, '');
  // Accept 10 or 12 digits
  if (!(raw.length === 10 || raw.length === 12)) return false;

  // Extract date part and serial
  let datePart = raw.length === 12 ? raw.slice(0, 8) : raw.slice(0, 6);
  // For Luhn checksum we need the last 10 digits (YYMMDDNNNN)
  const luhnSource = raw.length === 12 ? raw.slice(2) : raw;

  // Validate date
  let year, month, day;
  if (datePart.length === 8) {
    year = Number(datePart.slice(0, 4));
    month = Number(datePart.slice(4, 6));
    day = Number(datePart.slice(6, 8));
  } else {
    // YYMMDD -> assume 1900/2000 ambiguous; just validate month/day
    year = Number(datePart.slice(0, 2));
    month = Number(datePart.slice(2, 4));
    day = Number(datePart.slice(4, 6));
  }
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // Basic day-month check
  const mdays = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (datePart.length >= 6) {
    const mon = month - 1;
    if (mon < 0 || mon > 11) return false;
    if (day > mdays[mon]) return false;
  }

  // Luhn check on last 10 digits
  const digits = luhnSource.split('').map((d) => Number(d));
  if (digits.length !== 10 || digits.some((n) => Number.isNaN(n))) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let val = digits[i];
    // multiply by 2 for even indexes (0-based) when applying Luhn from left on 10-digit
    if (i % 2 === 0) val = val * 2;
    if (val > 9) val = val - 9;
    sum += val;
  }
  return sum % 10 === 0;
}

/**
 * Plocka ut adressdelar från kundobjektet, med lite tolerans för olika kolumnnamn.
 */
function extractAddressPartsFromCustomer(customer) {
  const addrStreetRaw = String(
    customer.addressStreet || customer.street || ''
  ).trim();

  let street = addrStreetRaw || null;
  let number = null;

  if (addrStreetRaw) {
    const tokens = addrStreetRaw.split(/\s+/);
    const last = tokens[tokens.length - 1] || '';
    if (/\d/.test(last)) {
      number = last;
      tokens.pop();
      street = tokens.join(' ') || null;
    }
  }

  const zipcode =
    String(
      customer.addressZip ||
        customer.zipcode ||
        customer.postalCode ||
        customer.zip ||
        ''
    ).trim() || null;

  const city =
    String(customer.addressCity || customer.city || '').trim() || null;

  return { street, number, zipcode, city };
}

/**
 * Bygger ett standardiserat svar som matchar frontend/api.js:
 *  - vehiclesCount / propertiesCount / vehicles / properties
 *  - lastUpdated (ISO, frontend kapar till YYYY-MM-DD)
 *  - validatedAddress (text)
 *  - addressStatus (t.ex. VERIFIED / FROM_PROFILE / NO_ADDRESS / NO_DATA / osv.)
 */
function buildExternalDataResponse(customer, externalAddress) {
  let validatedAddress = null;
  let status = '-';

  if (externalAddress && typeof externalAddress === 'object') {
    const addrObj =
      externalAddress.normalizedAddress ||
      externalAddress.address ||
      externalAddress;

    const streetExt =
      addrObj.street || addrObj.addressStreet || addrObj.gatuadress || null;
    const zipExt =
      addrObj.zipcode ||
      addrObj.postalCode ||
      addrObj.postnr ||
      addrObj.zip ||
      null;
    const cityExt =
      addrObj.city ||
      addrObj.postort ||
      addrObj.addressCity ||
      null;

    const partsExt = [streetExt, zipExt, cityExt].filter(Boolean);
    if (partsExt.length) {
      validatedAddress = partsExt.join(', ');
    }

    if (externalAddress.status) {
      status = String(externalAddress.status).toUpperCase();
    } else if (externalAddress.matchStatus) {
      status = String(externalAddress.matchStatus).toUpperCase();
    } else {
      status = 'VERIFIED';
    }
  }

  // Fallback: använd kundens egen adress om vi inte fick någon bättre
  if (!validatedAddress) {
    const street = customer.addressStreet || customer.street || null;
    const zip = customer.addressZip || customer.postalCode || null;
    const city = customer.addressCity || customer.city || null;
    const parts = [street, zip, city].filter(Boolean);
    if (parts.length) {
      validatedAddress = parts.join(', ');
      if (status === '-') status = 'FROM_PROFILE';
    }
  }

  if (!validatedAddress) {
    validatedAddress = null;
    if (status === '-') status = 'NO_ADDRESS';
  }

  const now = new Date().toISOString();

  return {
    ok: true,
    // just nu inga kopplingar till fordon/fastighet – men fälten finns
    vehiclesCount: 0,
    propertiesCount: 0,
    vehicles: 0,
    properties: 0,
    // frontend api.js: formatDate(json.lastUpdated)
    lastUpdated: now,
    validatedAddress,
    addressStatus: status,
  };
}

/** Mappa svenska/engelska etiketter -> enum ReportReason */
function mapReportReason(input) {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();

  const direct = [
    'fraud',
    'impersonation',
    'non_delivery',
    'counterfeit',
    'payment_abuse',
    'other',
  ];
  const directClean = v.replace('-', '_');
  if (direct.includes(directClean)) {
    return directClean.toUpperCase();
  }

  if (v.includes('bedrägeri') || v.includes('fraud')) return 'FRAUD';
  if (v.includes('identitets') || v.includes('imitation') || v.includes('impersonation')) return 'IMPERSONATION';
  if (v.includes('utebliven') || v.includes('leverans') || v.includes('non')) return 'NON_DELIVERY';
  if (v.includes('förfalsk') || v.includes('counterfeit')) return 'COUNTERFEIT';
  if (v.includes('betalning') || v.includes('missbruk') || v.includes('payment')) return 'PAYMENT_ABUSE';
  return 'OTHER';
}

module.exports = {
  nowIso,
  normSubject,
  clean,
  normalizePhone,
  normalizeCheckbox,
  isValidPersonalNumber,
  extractAddressPartsFromCustomer,
  buildExternalDataResponse,
  mapReportReason,
};
