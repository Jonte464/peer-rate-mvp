require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

const {
  createRating,
  createReport,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,
} = require('./storage');

const app = express();

// --- Config ---
const PORT = process.env.PORT || 3001; // default 3001 (Render sätter PORT i prod)
const HOST = '0.0.0.0';
const REQUESTS_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);

// Lita på proxy (Render/Vercel/NGINX m.m.)
app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json({ limit: '200kb' }));
app.use(helmet());
app.use(compression());

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

/** Mappa svenska/engelska etiketter -> enum ReportReason */
function mapReportReason(input) {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();

  // Tillåt redan korrekta enum-värden
  const direct = ['fraud','impersonation','non_delivery','counterfeit','payment_abuse','other'];
  const directClean = v.replace('-', '_');
  if (direct.includes(directClean)) {
    return directClean.toUpperCase();
  }

  // Svenska/vanliga etiketter
  if (v.includes('bedrägeri') || v.includes('fraud')) return 'FRAUD';
  if (v.includes('identitets') || v.includes('imitation') || v.includes('impersonation')) return 'IMPERSONATION';
  if (v.includes('utebliven') || v.includes('leverans') || v.includes('non') ) return 'NON_DELIVERY';
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
const reportSchema = Joi.object({
  report_flag: Joi.boolean().optional(),
  report_reason: Joi.string().allow('', null),
  report_text: Joi.string().allow('', null),
  evidence_url: Joi.string().uri().allow('', null),
  report_consent: Joi.boolean().optional(),
}).unknown(false);

const createRatingSchema = Joi.object({
  subject: Joi.string().min(2).max(200).required(),
  rater: Joi.string().min(2).max(200).optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('', null),
  proofRef: Joi.string().max(200).allow('', null),

  // Valfri rapportdel
  report: reportSchema.optional(),
});

// --- API: skapa betyg (+ ev. rapport) ---
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
      const consentOk = (r.report_consent === undefined) ? true : !!r.report_consent;
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

// --- Fallback: Single Page App ---
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate MVP running on ${HOST}:${PORT}`);
});
