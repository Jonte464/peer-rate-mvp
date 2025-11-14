require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

const {
  getOrCreateCustomerBySubjectRef,
  createRating,
  createReport,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,
  createCustomer,
  searchCustomers,
} = require('./storage');

const app = express();

// --- Config ---
const PORT = process.env.PORT || 3001; // default 3001 (Render sätter PORT i prod)
const HOST = '0.0.0.0';
const REQUESTS_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);

// Lita på proxy (Render/Vercel/NGINX m.m.)
app.set('trust proxy', 1);

// --- Middleware ---
// JSON-body
app.use(express.json({ limit: '200kb' }));

// Helmet – men stäng av frameguard + CSP, vi sätter egna nedan
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
  })
);

// Komprimering
app.use(compression());

// Tillåt inbäddning i Wix (iframe)
app.use((req, res, next) => {
  // Vem får bädda in sidan?
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://www.peerrate.ai https://peerrate.ai https://editor.wix.com https://www.wix.com"
  );
  // X-Frame-Options används av vissa äldre webbläsare
  res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.peerrate.ai');
  next();
});

// CORS (för API-anrop)
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

/** Mappa svenska/engelska etiketter -> enum ReportReason */
function mapReportReason(input) {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();

  // Tillåt redan korrekta enum-värden
  const direct = ['fraud', 'impersonation', 'non_delivery', 'counterfeit', 'payment_abuse', 'other'];
  const directClean = v.replace('-', '_');
  if (direct.includes(directClean)) {
    return directClean.toUpperCase();
  }

  // Svenska/vanliga etiketter
  if (v.includes('bedrägeri') || v.includes('fraud')) return 'FRAUD';
  if (v.includes('identitets') || v.includes('imitation') || v.includes('impersonation')) return 'IMPERSONATION';
  if (v.includes('utebliven') || v.includes('leverans') || v.includes('non')) return 'NON_DELIVERY';
  if (v.includes('förfalsk') || v.includes('counterfeit')) return 'COUNTERFEIT';
  if (v.includes('betalning') || v.includes('missbruk') || v.includes('payment')) return 'PAYMENT_ABUSE';
  return 'OTHER';
}

// --- Health (båda vägarna) ---
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

// --- Validation ---
// Tillåt extra fält i report (t.ex. report_when, report_amount_sek, report_link, report_files)
const reportSchema = Joi.object({
  report_flag: Joi.boolean().optional(),
  report_reason: Joi.string().allow('', null),
  report_text: Joi.string().allow('', null),
  evidence_url: Joi.string().uri().allow('', null),
  report_consent: Joi.boolean().optional(),
}).unknown(true); // <— VIKTIG: tillåt okända nycklar i report

const createRatingSchema = Joi.object({
  subject: Joi.string().min(2).max(200).required(),
  // gör rater “snäll” så tom/null accepteras
  rater: Joi.string().min(2).max(200).allow('', null).optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('', null),
  proofRef: Joi.string().max(200).allow('', null),

  // Valfri rapportdel
  report: reportSchema.optional(),
});

/** Validering: skapa kund i kundregister */
const createCustomerSchema = Joi.object({
  subjectRef: Joi.string().min(2).max(200).required(),
  fullName: Joi.string().min(2).max(200).required(),
  personalNumber: Joi.string()
    .pattern(/^\d{10,12}$/)
    .allow('', null),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().max(50).allow('', null),
  addressStreet: Joi.string().max(200).allow('', null),
  addressZip: Joi.string().max(20).allow('', null),
  addressCity: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).allow('', null),
});

// --- API: skapa betyg (+ ev. rapport) ---
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
    // 1) Skapa rating
    const { customerId, ratingId } = await createRating({
      subjectRef,
      rating,
      comment,
      raterName,
      proofRef,
      createdAt: nowIso(),
    });

    // 2) Skapa ev. rapport
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

// --- API: lista betyg för subject ---
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

// --- API: snitt ---
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

// --- API: senaste ---
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
   Kundregister API
   ------------------------------------------------------- */

// Skapa kund
app.post('/api/customers', async (req, res) => {
  const { error, value } = createCustomerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      ok: false,
      error: 'Ogiltig kunddata',
      details: error.details,
    });
  }

  // Städa tomma strängar -> null, så databasen inte får "" i onödan
  const clean = (s) => {
    if (s === undefined || s === null) return null;
    const trimmed = String(s).trim();
    return trimmed === '' ? null : trimmed;
  };

  const payload = {
    subjectRef: clean(value.subjectRef),
    fullName: clean(value.fullName),
    personalNumber: clean(value.personalNumber),
    email: clean(value.email),
    phone: clean(value.phone),
    addressStreet: clean(value.addressStreet),
    addressZip: clean(value.addressZip),
    addressCity: clean(value.addressCity),
    country: clean(value.country),
  };

  try {
    const customer = await createCustomer(payload);
    return res.status(201).json({ ok: true, customer });
  } catch (e) {
    console.error('[POST /api/customers] error:', e);

    // Prisma unik-constraints (t.ex. subjectRef eller personalNumber)
    if (e.code === 'P2002') {
      return res.status(409).json({
        ok: false,
        error: 'Det finns redan en kund med samma subjectRef eller personnummer.',
      });
    }

    return res.status(500).json({ ok: false, error: 'Kunde inte spara kund' });
  }
});

// Sök kund
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

// --- Fallback: Single Page App ---
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate MVP running on ${HOST}:${PORT}`);
});
