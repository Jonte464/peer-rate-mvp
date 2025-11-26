require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const { connectBlocketProfile } = require('./services/blocketService');


// ✅ Prisma-klient direkt här (ingen prismaClient-fil behövs)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ INGEN node-fetch här – Node 20 har fetch inbyggt globalt

const {
  getOrCreateCustomerBySubjectRef,
  createRating,
  createReport,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,
  createCustomer,
  searchCustomers,
  findCustomerBySubjectRef,
  adminGetCounts,
  adminListRecentReports,
  adminGetCustomerWithRatings,
} = require('./storage');

// PAP API service (adressverifiering)
const { lookupAddressWithPapApi } = require('./services/papApiService');

const app = express();

// --- Config ---
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
const REQUESTS_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

// Lita på proxy (Render/Vercel/NGINX m.m.)
app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json({ limit: '200kb' }));
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
  })
);
app.use(compression());

// Tillåt inbäddning i Wix (iframe)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://www.peerrate.ai https://peerrate.ai https://editor.wix.com https://www.wix.com"
  );
  res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.peerrate.ai');
  next();
});

// CORS
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// Statik (frontend)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Rate limit för API
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: REQUESTS_PER_MIN,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Helpers ---
function nowIso() {
  return new Date().toISOString();
}
function normSubject(s) {
  return String(s || '').trim().toLowerCase();
}
function clean(s) {
  if (s === undefined || s === null) return null;
  const trimmed = String(s).trim();
  return trimmed === '' ? null : trimmed;
}
function normalizePhone(s) {
  const v = clean(s);
  if (!v) return null;
  const stripped = v.replace(/[^0-9+]/g, '');
  return stripped || null;
}
function normalizeCheckbox(v) {
  return v === true || v === 'true' || v === 'on' || v === '1';
}

// Validate Swedish personal identity number (YYYYMMDDNNNN or YYMMDDNNNN)
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

// --- External data helpers ---

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

  const zipcode = String(
    customer.addressZip ||
      customer.zipcode ||
      customer.postalCode ||
      customer.zip ||
      ''
  ).trim() || null;

  const city = String(
    customer.addressCity || customer.city || ''
  ).trim() || null;

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

// --- Health ---
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    port: PORT,
    corsOrigin,
    uptimeSec: Math.round(process.uptime()),
  });
});

// Enkel auth-middleware för /api/customers/me/external-data (ej använd än)
function requireAuth(req, res, next) {
  if (req.user && req.user.id) return next();
  return res.status(401).json({ ok: false, error: 'Ej inloggad' });
}

/**
 * GET /api/customers/external-data
 * Hämtar ENDAST extern data. Ingen fallback till profilen.
 * Frontend förväntar sig:
 * { ok, vehiclesCount, propertiesCount, lastUpdated, validatedAddress, addressStatus }
 */
app.get('/api/customers/external-data', async (req, res) => {
  try {
    const emailOrSubject = String(req.query.email || '').trim().toLowerCase();
    if (!emailOrSubject) {
      return res.status(400).json({ ok: false, error: 'Saknar email' });
    }

    // Hitta kund via subjectRef eller email
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { subjectRef: emailOrSubject },
          { email: emailOrSubject },
        ],
      },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    // Plocka ut adressdelar från kundprofilen ENBART för att slå mot extern tjänst
    // (vi använder INTE dessa direkt som "validerad" adress)
    const { street, number, zipcode, city } =
      extractAddressPartsFromCustomer(customer); // helper som du redan har i server.js

    let validatedAddress = null;
    let addressStatus = 'NO_EXTERNAL_DATA';
    let vehiclesCount = null;
    let propertiesCount = null;

    // Anropa extern adress-tjänst om vi har något att slå på
    if (street || zipcode || city) {
      try {
        const externalAddress = await lookupAddressWithPapApi({
          street,
          number,
          zipcode,
          city,
        });

        if (externalAddress && typeof externalAddress === 'object') {
          const addrObj =
            externalAddress.normalizedAddress ||
            externalAddress.address ||
            externalAddress;

          const extStreet =
            addrObj.street || addrObj.addressStreet || addrObj.gatuadress || null;
          const extZip =
            addrObj.zipcode || addrObj.postalCode || addrObj.postnr || null;
          const extCity =
            addrObj.city || addrObj.postort || addrObj.addressCity || null;

          const parts = [extStreet, extZip, extCity].filter(Boolean);
          if (parts.length) {
            validatedAddress = parts.join(', ');
          }

          // Om externa källan råkar ge antal fordon/fastigheter i framtiden
          vehiclesCount =
            externalAddress.vehiclesCount ??
            externalAddress.vehicleCount ??
            externalAddress.vehicles ??
            null;

          propertiesCount =
            externalAddress.propertiesCount ??
            externalAddress.propertyCount ??
            externalAddress.properties ??
            null;

          if (validatedAddress) {
            addressStatus = externalAddress.status
              ? String(externalAddress.status).toUpperCase()
              : (externalAddress.matchStatus
                  ? String(externalAddress.matchStatus).toUpperCase()
                  : 'VERIFIED');
          } else {
            addressStatus = 'NO_ADDRESS_IN_RESPONSE';
          }
        }
      } catch (err) {
        console.error('PAP API lookup failed', err);
        addressStatus = 'LOOKUP_FAILED';
      }
    } else {
      addressStatus = 'NO_ADDRESS_INPUT';
    }

    const now = new Date().toISOString();

    return res.json({
      ok: true,
      vehiclesCount,
      propertiesCount,
      lastUpdated: now,
      validatedAddress,
      addressStatus,
    });
  } catch (err) {
    console.error('external-data error', err);
    return res.status(500).json({ ok: false, error: 'Internt serverfel' });
  }
});


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

// --- Validation ---
const reportSchema = Joi.object({
  report_flag: Joi.boolean().optional(),
  report_reason: Joi.string().allow('', null),
  report_text: Joi.string().allow('', null),
  evidence_url: Joi.string().uri().allow('', null),
  report_consent: Joi.boolean().optional(),
}).unknown(true);

const createRatingSchema = Joi.object({
  subject: Joi.string().min(2).max(200).required(),
  rater: Joi.string().min(2).max(200).allow('', null).optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('', null),
  proofRef: Joi.string().max(200).allow('', null),
  report: reportSchema.optional(),
});

/** Skapa kund */
const createCustomerSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  personalNumber: Joi.string()
    .custom((value, helpers) => {
      if (!isValidPersonalNumber(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required(),
  email: Joi.string().email().required(),
  emailConfirm: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
  passwordConfirm: Joi.string().min(8).max(100).required(),
  phone: Joi.string()
    .pattern(/^[0-9+\s\-()]*$/)
    .allow('', null),
  addressStreet: Joi.string().max(200).allow('', null),
  addressZip: Joi.string().max(20).allow('', null),
  addressCity: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).allow('', null),

  // NYTT: Blocket-fält (valfria)
  blocketEmail: Joi.string().email().allow('', null),
  blocketPassword: Joi.string().min(1).max(200).allow('', null),

  // Samtycken – måste vara TRUE
  thirdPartyConsent: Joi.boolean().valid(true).required(),
  termsAccepted: Joi.boolean().valid(true).required(),
});


/** Login */
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

/** Enkel admin-login (lösenord från .env) */
const adminLoginSchema = Joi.object({
  password: Joi.string().min(6).max(200).required(),
});

// --- Middleware: admin-skydd ---
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res
      .status(500)
      .json({
        ok: false,
        error: 'Admin-läge ej konfigurerat (saknar ADMIN_PASSWORD).',
      });
  }
  const key = req.headers['x-admin-key'] || '';
  if (key && key === ADMIN_PASSWORD) return next();
  return res.status(401).json({ ok: false, error: 'Ej behörig (admin).' });
}

/* -------------------------------------------------------
   API: skapa betyg
   ------------------------------------------------------- */
app.post('/api/ratings', async (req, res) => {
  const { error, value } = createRatingSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ogiltig inmatning', details: error.details });
  }

  const subjectRef = normSubject(value.subject);
  const rating = value.rating;
  const comment = (value.comment || '').toString().trim();
  const raterName = (value.rater || '').toString().trim() || null;
  const proofRef = (value.proofRef || '').toString().trim() || null;

  try {
    const { customerId, ratingId } = await createRating({
      subjectRef,
      rating,
      comment,
      raterName,
      proofRef,
      createdAt: nowIso(),
    });

    const r = value.report || null;
    if (r) {
      const flagged =
        r.report_flag === true || !!r.report_reason || !!r.report_text;
      const consentOk =
        r.report_consent === undefined ? true : !!r.report_consent;
      if (flagged && consentOk) {
        const reasonEnum = mapReportReason(r.report_reason);
        await createReport({
          reportedCustomerId: customerId,
          ratingId,
          reason: reasonEnum || 'OTHER',
          details: r.report_text || null,
          evidenceUrl: r.evidence_url || null,
        });
      }
    }

    return res.status(201).json({ ok: true });
  } catch (e) {
    if (e && e.code === 'DUP_24H') {
      return res.status(409).json({
        ok: false,
        error:
          'Du har redan lämnat betyg för denna mottagare senaste 24 timmarna.',
      });
    }
    console.error('[POST /api/ratings] error:', e);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte spara betyg' });
  }
});

app.post('/api/external/blocket/connect', async (req, res) => {
  try {
    const { customerId, username, password } = req.body;

    if (!customerId || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const profile = await connectBlocketProfile(customerId, username, password);

    res.json({
      success: true,
      profile
    });

  } catch (err) {
    console.error('Blocket connect error:', err);
    res.status(500).json({ error: 'Failed to connect Blocket profile' });
  }
});

/* -------------------------------------------------------
   API: lista betyg för subject
   ------------------------------------------------------- */
app.get('/api/ratings', async (req, res) => {
  const subject = normSubject(req.query.subject || '');
  if (!subject) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ange subject i querystring.' });
  }
  try {
    const list = await listRatingsBySubjectRef(subject);
    res.json({ ok: true, count: list.length, ratings: list });
  } catch (e) {
    console.error('[GET /api/ratings] error:', e);
    res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hämta betyg' });
  }
});

/* -------------------------------------------------------
   API: snitt
   ------------------------------------------------------- */
app.get('/api/ratings/average', async (req, res) => {
  const subject = normSubject(req.query.subject || '');
  if (!subject) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ange subject i querystring.' });
  }
  try {
    const { count, average } = await averageForSubjectRef(subject);
    res.json({ ok: true, subject, count, average });
  } catch (e) {
    console.error('[GET /api/ratings/average] error:', e);
    res
      .status(500)
      .json({ ok: false, error: 'Kunde inte beräkna snitt' });
  }
});

/* -------------------------------------------------------
   API: senaste globalt
   ------------------------------------------------------- */
app.get('/api/ratings/recent', async (_req, res) => {
  try {
    const list = await listRecentRatings(20);
    res.json({ ok: true, ratings: list });
  } catch (e) {
    console.error('[GET /api/ratings/recent] error:', e);
    res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hämta senaste' });
  }
});

/* -------------------------------------------------------
   Kundregister: registrera dig
   ------------------------------------------------------- */
app.post('/api/customers', async (req, res) => {
  // Normalisera checkboxar innan validering
  const raw = req.body || {};
  // Extra debug: visa rå body exakt som den kom in (används för att felsöka produktion)
  console.log('DEBUG raw req.body (incoming):', JSON.stringify(raw));

  const body = {
    ...raw,
    thirdPartyConsent: normalizeCheckbox(raw.thirdPartyConsent),
    termsAccepted: normalizeCheckbox(raw.termsAccepted),
  };

  console.log(
    'DEBUG backend /api/customers body:',
    'thirdPartyConsent =',
    body.thirdPartyConsent,
    'termsAccepted =',
    body.termsAccepted
  );

  const { error, value } = createCustomerSchema.validate(body);

  if (error) {
    const firstDetail = error.details && error.details[0];
    const key =
      (firstDetail && firstDetail.context && firstDetail.context.key) ||
      (firstDetail && firstDetail.path && firstDetail.path[0]);

    let friendlyField = null;
    switch (key) {
      case 'firstName':
        friendlyField = 'förnamn';
        break;
      case 'lastName':
        friendlyField = 'efternamn';
        break;
      case 'personalNumber':
        friendlyField = 'personnummer';
        break;
      case 'email':
        friendlyField = 'e-post';
        break;
      case 'emailConfirm':
        friendlyField = 'bekräfta e-post';
        break;
      case 'phone':
        friendlyField = 'telefonnummer';
        break;
      case 'addressStreet':
        friendlyField = 'gatuadress';
        break;
      case 'addressZip':
        friendlyField = 'postnummer';
        break;
      case 'addressCity':
        friendlyField = 'ort';
        break;
      case 'country':
        friendlyField = 'land';
        break;
      case 'password':
        friendlyField = 'lösenord';
        break;
      case 'passwordConfirm':
        friendlyField = 'bekräfta lösenord';
        break;
      case 'blocketEmail':
        friendlyField = 'Blocket-e-post';
        break;
      case 'blocketPassword':
        friendlyField = 'Blocket-lösenord';
        break;
      case 'thirdPartyConsent':
        friendlyField = 'samtycke till tredjepartsdata';
        break;
      case 'termsAccepted':
        friendlyField = 'godkännande av villkor och integritetspolicy';
        break;
      default:
        friendlyField = null;
    }

    // Specialfall: ogiltigt personnummer
    if (key === 'personalNumber') {
      return res
        .status(400)
        .json({ ok: false, error: 'Ogiltigt personnummer.' });
    }

    const msg = friendlyField
      ? `Kontrollera fältet: ${friendlyField}.`
      : 'En eller flera uppgifter är ogiltiga. Kontrollera formuläret.';

    return res.status(400).json({ ok: false, error: msg });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();
  const emailConfirmTrim = String(value.emailConfirm || '').trim().toLowerCase();
  if (!emailTrim || emailTrim !== emailConfirmTrim) {
    return res
      .status(400)
      .json({ ok: false, error: 'E-postadresserna matchar inte.' });
  }

  if (value.password !== value.passwordConfirm) {
    return res
      .status(400)
      .json({ ok: false, error: 'Lösenorden matchar inte.' });
  }

  // Här vet vi: thirdPartyConsent = true, termsAccepted = true (validerat av Joi)
  const fullName =
    `${clean(value.firstName) || ''} ${clean(value.lastName) || ''}`.trim() ||
    null;
  const passwordHash = await bcrypt.hash(value.password, 10);

  const payload = {
    subjectRef: emailTrim,
    fullName,
    personalNumber: clean(value.personalNumber),
    email: clean(value.email),
    phone: normalizePhone(value.phone),
    addressStreet: clean(value.addressStreet),
    addressZip: clean(value.addressZip),
    addressCity: clean(value.addressCity),
    country: clean(value.country),
    passwordHash,
    thirdPartyConsent: value.thirdPartyConsent === true,
    // termsAccepted sparas inte i DB just nu – bara valideras
  };

  // NYTT: plocka ut Blocket-fält (valfria)
  const blocketEmail =
    (value.blocketEmail && String(value.blocketEmail).trim()) || '';
  const blocketPassword = value.blocketPassword || '';

  try {
    const customer = await createCustomer(payload);

    // NYTT: starta Blocket-koppling i bakgrunden om båda fälten är ifyllda
    if (blocketEmail && blocketPassword) {
      connectBlocketProfile(customer.id, blocketEmail, blocketPassword)
        .then(() => {
          console.log(
            `Blocket-profil kopplad för kund ${customer.id} (${blocketEmail})`
          );
        })
        .catch((err) => {
          console.error(
            `Misslyckades att koppla Blocket-profil för kund ${customer.id}`,
            err
          );
        });
    }

    return res.status(201).json({
      ok: true,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        subjectRef: customer.subjectRef,
      },
    });
  } catch (e) {
    console.error('[POST /api/customers] error:', e);

    if (e.code === 'P2002') {
      return res.status(409).json({
        ok: false,
        error:
          'Det finns redan en användare med samma e-post eller personnummer.',
      });
    }

  }
});


/* -------------------------------------------------------
   Login – används av “Lämna betyg” & “Min profil”
   ------------------------------------------------------- */
app.post('/api/auth/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ogiltiga inloggningsuppgifter.' });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();

  try {
    const customer = await findCustomerBySubjectRef(emailTrim);
    if (!customer || !customer.passwordHash) {
      return res
        .status(401)
        .json({ ok: false, error: 'Fel e-post eller lösenord.' });
    }

    const match = await bcrypt.compare(value.password, customer.passwordHash);
    if (!match) {
      return res
        .status(401)
        .json({ ok: false, error: 'Fel e-post eller lösenord.' });
    }

    return res.status(200).json({
      ok: true,
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
      },
    });
  } catch (e) {
    console.error('[POST /api/auth/login] error:', e);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte logga in.' });
  }
});

// --- Kundsök (kan användas i framtida admin-UI) ---
app.get('/api/customers', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ange q i querystring.' });
  }

  try {
    const customers = await searchCustomers(q);
    res.json({ ok: true, count: customers.length, customers });
  } catch (e) {
    console.error('[GET /api/customers] error:', e);
    res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hämta kunder' });
  }
});

/* -------------------------------------------------------
   ADMIN-API
   ------------------------------------------------------- */

/** Enkel admin-login: skickar in samma lösenord som i .env */
app.post('/api/admin/login', (req, res) => {
  const { error, value } = adminLoginSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ogiltigt admin-lösenord.' });
  }
  if (!ADMIN_PASSWORD) {
    return res
      .status(500)
      .json({ ok: false, error: 'ADMIN_PASSWORD saknas i servern.' });
  }
  if (value.password !== ADMIN_PASSWORD) {
    return res
      .status(401)
      .json({ ok: false, error: 'Fel admin-lösenord.' });
  }
  // Frontend sparar detta lösenord och skickar i x-admin-key-header.
  res.json({ ok: true });
});

/** Admin-översikt: totalsiffror */
app.get('/api/admin/summary', requireAdmin, async (_req, res) => {
  try {
    const counts = await adminGetCounts();
    res.json({ ok: true, counts });
  } catch (e) {
    console.error('[GET /api/admin/summary] error:', e);
    res.status(500).json({
      ok: false,
      error: 'Kunde inte hämta admin-sammanfattning.',
    });
  }
});

/** Senaste ratings (admin) */
app.get('/api/admin/ratings/recent', requireAdmin, async (req, res) => {
  const limit = Number(req.query.limit || 20);
  try {
    const list = await listRecentRatings(limit);
    res.json({ ok: true, ratings: list });
  } catch (e) {
    console.error('[GET /api/admin/ratings/recent] error:', e);
    res.status(500).json({
      ok: false,
      error: 'Kunde inte hämta senaste ratings (admin).',
    });
  }
});

/** Senaste rapporter (admin) */
app.get('/api/admin/reports/recent', requireAdmin, async (req, res) => {
  const limit = Number(req.query.limit || 20);
  try {
    const list = await adminListRecentReports(limit);
    res.json({ ok: true, reports: list });
  } catch (e) {
    console.error('[GET /api/admin/reports/recent] error:', e);
    res.status(500).json({
      ok: false,
      error: 'Kunde inte hämta senaste rapporter (admin).',
    });
  }
});

/** Lista kunder (admin) */
app.get('/api/admin/customers', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(
      1000,
      Math.max(1, Number(req.query.limit || 50))
    );
    const skip = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          subjectRef: true,
          fullName: true,
          email: true,
          personalNumber: true,
          createdAt: true,
        },
      }),
      prisma.customer.count(),
    ]);

    const customers = rows.map((r) => ({
      id: r.id,
      subjectRef: r.subjectRef,
      fullName: r.fullName || null,
      email: r.email || null,
      personalNumber: r.personalNumber || null,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    }));

    res.json({
      ok: true,
      count: customers.length,
      total,
      page,
      pageSize,
      customers,
    });
  } catch (e) {
    console.error('[GET /api/admin/customers] error:', e);
    res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hämta kunder' });
  }
});

/** Sök kund + ratings (admin) */
app.get('/api/admin/customer', requireAdmin, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q)
    return res
      .status(400)
      .json({ ok: false, error: 'Ange q i querystring.' });

  try {
    const customer = await adminGetCustomerWithRatings(q);
    if (!customer) {
      return res.json({ ok: true, customer: null });
    }
    const subjectRef =
      customer.subjectRef || (customer.email || '').toLowerCase();
    let avgData = { count: 0, average: 0 };
    if (subjectRef) {
      avgData = await averageForSubjectRef(subjectRef);
    }

    res.json({
      ok: true,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        subjectRef: customer.subjectRef,
        email: customer.email,
        personalNumber: customer.personalNumber,
        createdAt: customer.createdAt,
        ratings: customer.ratings.map((r) => ({
          id: r.id,
          score: r.score,
          text: r.text,
          raterName: r.raterName,
          createdAt: r.createdAt,
        })),
        average: avgData.average,
        count: avgData.count,
      },
    });
  } catch (e) {
    console.error('[GET /api/admin/customer] error:', e);
    res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hämta kund (admin).' });
  }
});

/* -------------------------------------------------------
   Hämta extern data (DEMO) baserat på profil
   ------------------------------------------------------- */
app.get('/api/profile/external-demo', async (req, res) => {
  try {
    // 1) authenticated requests där req.user.id finns (framtid)
    // 2) publik lookup: ?subject=<email|subjectRef>
    const subjectQ = String(req.query.subject || '').trim().toLowerCase();

    let customer = null;
    if (req.user && req.user.id) {
      customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
      });
    } else if (subjectQ) {
      customer = await findCustomerBySubjectRef(subjectQ);
    } else {
      return res.status(401).json({
        ok: false,
        error:
          'Ej inloggad. Ange subject som queryparameter för publik lookup.',
      });
    }

    if (!customer)
      return res.status(404).json({ ok: false, error: 'Kund saknas' });

    const { street, number, zipcode, city } =
      extractAddressPartsFromCustomer(customer);

    let externalAddress = null;
    try {
      if (street || zipcode || city) {
        externalAddress = await lookupAddressWithPapApi({
          street,
          number,
          zipcode,
          city,
        });
      }
    } catch (err) {
      console.error('PAP API lookup failed', err);
      externalAddress = null;
    }

    const payload = buildExternalDataResponse(customer, externalAddress);
    return res.json(payload);
  } catch (err) {
    console.error('External demo error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Serverfel vid extern hämtning',
    });
  }
});

// --- Fallback: SPA --- (lägg allra sist)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate MVP running on ${HOST}:${PORT}`);
});
