require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const bcrypt = require('bcryptjs');

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

/** Mappa svenska/engelska etiketter -> enum ReportReason */
function mapReportReason(input) {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();

  const direct = ['fraud', 'impersonation', 'non_delivery', 'counterfeit', 'payment_abuse', 'other'];
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
    .pattern(/^\d{10,12}$/)
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

  // NYTT: samtycke – måste vara TRUE
  thirdPartyConsent: Joi.boolean().valid(true).required(),
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
    return res.status(500).json({ ok: false, error: 'Admin-läge ej konfigurerat (saknar ADMIN_PASSWORD).' });
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
    return res.status(400).json({ ok: false, error: 'Ogiltig inmatning', details: error.details });
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
      const flagged = r.report_flag === true || !!r.report_reason || !!r.report_text;
      const consentOk = r.report_consent === undefined ? true : !!r.report_consent;
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
        error: 'Du har redan lämnat betyg för denna mottagare senaste 24 timmarna.',
      });
    }
    console.error('[POST /api/ratings] error:', e);
    return res.status(500).json({ ok: false, error: 'Kunde inte spara betyg' });
  }
});

/* -------------------------------------------------------
   API: lista betyg för subject
   ------------------------------------------------------- */
app.get('/api/ratings', async (req, res) => {
  const subject = normSubject(req.query.subject || '');
  if (!subject) {
    return res.status(400).json({ ok: false, error: 'Ange subject i querystring.' });
  }
  try {
    const list = await listRatingsBySubjectRef(subject);
    res.json({ ok: true, count: list.length, ratings: list });
  } catch (e) {
    console.error('[GET /api/ratings] error:', e);
    res.status(500).json({ ok: false, error: 'Kunde inte hämta betyg' });
  }
});

/* -------------------------------------------------------
   API: snitt
   ------------------------------------------------------- */
app.get('/api/ratings/average', async (req, res) => {
  const subject = normSubject(req.query.subject || '');
  if (!subject) {
    return res.status(400).json({ ok: false, error: 'Ange subject i querystring.' });
  }
  try {
    const { count, average } = await averageForSubjectRef(subject);
    res.json({ ok: true, subject, count, average });
  } catch (e) {
    console.error('[GET /api/ratings/average] error:', e);
    res.status(500).json({ ok: false, error: 'Kunde inte beräkna snitt' });
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
    res.status(500).json({ ok: false, error: 'Kunde inte hämta senaste' });
  }
});

/* -------------------------------------------------------
   Kundregister: registrera dig
   ------------------------------------------------------- */
app.post('/api/customers', async (req, res) => {
  const { error, value } = createCustomerSchema.validate(req.body);
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
      case 'thirdPartyConsent':
        friendlyField = 'samtycke till tredjepartsdata';
        break;
      case 'termsAccepted':
        friendlyField = 'godkännande av villkor och integritetspolicy';
        break;
      default:
        friendlyField = null;
    }

    const msg = friendlyField
      ? `Kontrollera fältet: ${friendlyField}.`
      : 'En eller flera uppgifter är ogiltiga. Kontrollera formuläret.';

    return res.status(400).json({
      ok: false,
      error: msg,
    });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();
  const emailConfirmTrim = String(value.emailConfirm || '').trim().toLowerCase();
  if (!emailTrim || emailTrim !== emailConfirmTrim) {
    return res.status(400).json({ ok: false, error: 'E-postadresserna matchar inte.' });
  }

  if (value.password !== value.passwordConfirm) {
    return res.status(400).json({ ok: false, error: 'Lösenorden matchar inte.' });
  }

  // --- NYTT: kolla checkboxarna för samtycke ---
  const normalizeCheckbox = (v) =>
    v === true || v === 'true' || v === 'on' || v === '1';

  const thirdPartyConsent = normalizeCheckbox(req.body.thirdPartyConsent);
  const termsAccepted = normalizeCheckbox(req.body.termsAccepted);

  if (!thirdPartyConsent) {
    return res.status(400).json({
      ok: false,
      error: 'Du behöver samtycka till inhämtning från tredje part för att kunna registrera dig.',
    });
  }

  if (!termsAccepted) {
    return res.status(400).json({
      ok: false,
      error: 'Du måste godkänna användarvillkor och integritetspolicy för att kunna registrera dig.',
    });
  }
  // --- SLUT NYTT ---

  const clean = (s) => {
    if (s === undefined || s === null) return null;
    const trimmed = String(s).trim();
    return trimmed === '' ? null : trimmed;
  };

  const normalizePhone = (s) => {
    const v = clean(s);
    if (!v) return null;
    const stripped = v.replace(/[^\d+]/g, '');
    return stripped || null;
  };

  const fullName = `${clean(value.firstName) || ''} ${clean(value.lastName) || ''}`.trim() || null;

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
    // Om vi senare lägger in fält i databasen kan vi även spara dessa:
    // thirdPartyConsent,
    // termsAccepted,
  };

  try {
    const customer = await createCustomer(payload);
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
        error: 'Det finns redan en användare med samma e-post eller personnummer.',
      });
    }

    return res.status(500).json({ ok: false, error: 'Kunde inte spara kund' });
  }
});


/* -------------------------------------------------------
   Login – används av “Lämna betyg” & “Min profil”
   ------------------------------------------------------- */
app.post('/api/auth/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ ok: false, error: 'Ogiltiga inloggningsuppgifter.' });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();

  try {
    const customer = await findCustomerBySubjectRef(emailTrim);
    if (!customer || !customer.passwordHash) {
      return res.status(401).json({ ok: false, error: 'Fel e-post eller lösenord.' });
    }

    const match = await bcrypt.compare(value.password, customer.passwordHash);
    if (!match) {
      return res.status(401).json({ ok: false, error: 'Fel e-post eller lösenord.' });
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
    return res.status(500).json({ ok: false, error: 'Kunde inte logga in.' });
  }
});

// --- Kundsök (kan användas i framtida admin-UI) ---
app.get('/api/customers', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ ok: false, error: 'Ange q i querystring.' });
  }

  try {
    const customers = await searchCustomers(q);
    res.json({ ok: true, count: customers.length, customers });
  } catch (e) {
    console.error('[GET /api/customers] error:', e);
    res.status(500).json({ ok: false, error: 'Kunde inte hämta kunder' });
  }
});

/* -------------------------------------------------------
   ADMIN-API
   ------------------------------------------------------- */

/** Enkel admin-login: skickar in samma lösenord som i .env */
app.post('/api/admin/login', (req, res) => {
  const { error, value } = adminLoginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ ok: false, error: 'Ogiltigt admin-lösenord.' });
  }
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD saknas i servern.' });
  }
  if (value.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Fel admin-lösenord.' });
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
    res.status(500).json({ ok: false, error: 'Kunde inte hämta admin-sammanfattning.' });
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
    res.status(500).json({ ok: false, error: 'Kunde inte hämta senaste ratings (admin).' });
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
    res.status(500).json({ ok: false, error: 'Kunde inte hämta senaste rapporter (admin).' });
  }
});

/** Sök kund + ratings (admin) */
app.get('/api/admin/customer', requireAdmin, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ ok: false, error: 'Ange q i querystring.' });

  try {
    const customer = await adminGetCustomerWithRatings(q);
    if (!customer) {
      return res.json({ ok: true, customer: null });
    }

    const subjectRef = customer.subjectRef || (customer.email || '').toLowerCase();
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
    res.status(500).json({ ok: false, error: 'Kunde inte hämta kund (admin).' });
  }
});

// --- Fallback: SPA ---
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

/* -------------------------------------------------------
   Hämta extern data (DEMO) baserat på postnummer
   ------------------------------------------------------- */
app.get('/api/profile/external-demo', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ ok: false, error: 'Ej inloggad' });
    }

    // Hämta kund från databasen
    const customer = await prisma.customer.findUnique({
      where: { id: req.user.id },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund saknas' });
    }

    // Om användaren inte har postnummer → fel
    if (!customer.addressZip) {
      return res.status(400).json({
        ok: false,
        error: 'Användaren saknar postnummer. Lägg till det i din profil.',
      });
    }

    const zip = String(customer.addressZip).replace(/\s+/g, '');

    // Hämta extern data från gratis API
    const apiUrl = `https://api.zippopotam.us/SE/${zip}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      return res.status(404).json({
        ok: false,
        error: 'Ingen extern information hittades för detta postnummer.',
      });
    }

    const data = await response.json();

    return res.json({
      ok: true,
      source: 'zippopotam.us',
      postnummer: zip,
      ort: data.places?.[0]?.['place name'] || null,
      region: data.places?.[0]?.['state'] || null,
      latitude: data.places?.[0]?.latitude || null,
      longitude: data.places?.[0]?.longitude || null,
    });
  } catch (err) {
    console.error('External demo error:', err);
    return res.status(500).json({ ok: false, error: 'Serverfel vid extern hämtning' });
  }
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate MVP running on ${HOST}:${PORT}`);
});
