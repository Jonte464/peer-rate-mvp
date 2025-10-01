require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const Joi = require('joi');
const path = require('path');
const { readAll, writeAll } = require('./storage');

const app = express();

// --- Config ---
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const REQUESTS_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const dayMs = 24 * 60 * 60 * 1000;

// Lita på proxy för korrekt IP (Render/Vercel/NGINX m.m.)
app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json({ limit: '200kb' }));

// CORS: strikt i prod om CORS_ORIGIN finns, annars öppet (dev)
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// Servera frontend (statik)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Rate limiting (endast API)
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
function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
function nowIso() {
  return new Date().toISOString();
}
function normSubject(s) {
  return String(s || '').trim().toLowerCase();
}
function raterKeyFrom(rater, ip) {
  const base = (rater && String(rater).trim())
    ? String(rater).trim().toLowerCase()
    : ip;
  return sha256(`rater:${base}`);
}
function maskRater(r) {
  const s = r.toLowerCase();
  if (!s.includes('@')) return s;
  const [name, domain] = s.split('@');
  const shown = name.length <= 2 ? name[0] : name.slice(0, 2);
  return `${shown}***@${domain}`;
}

// --- Health (läggs före catch-all) ---
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

// --- Validation ---
const createRatingSchema = Joi.object({
  subject: Joi.string().min(2).max(200).required(),
  rater: Joi.string().min(2).max(200).optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('', null),
  proofRef: Joi.string().max(200).allow('', null),
});

// --- API: skapa betyg ---
app.post('/api/ratings', async (req, res) => {
  const { error, value } = createRatingSchema.validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ ok: false, error: 'Ogiltig inmatning', details: error.details });

  const subject = normSubject(value.subject);
  const rating = value.rating;
  const comment = (value.comment || '').toString().trim();
  const rater = (value.rater || '').toString().trim();

  // IP från proxy-header eller req.ip
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip;

  const raterKey = raterKeyFrom(rater, ip);

  const items = await readAll();
  const now = Date.now();

  // Dubblettspärr 24h
  const dup = items.find(
    (it) =>
      it.subject === subject &&
      it.raterKey === raterKey &&
      now - new Date(it.createdAt).getTime() < dayMs
  );
  if (dup) {
    return res.status(409).json({
      ok: false,
      error: 'Du har redan lämnat betyg för denna mottagare senaste 24 timmarna.',
    });
  }

  // Hasha ev. verifikationsreferens
  const proofRef = (value.proofRef || '').toString().trim();
  const proofHash = proofRef ? sha256(`${subject}|${proofRef}`) : null;

  const ratingItem = {
    id: crypto.randomUUID(),
    subject,
    rating,
    comment,
    hasProof: !!proofHash,
    proofHash,
    raterMasked: rater ? maskRater(rater) : null,
    raterKey,
    createdAt: nowIso(),
  };

  items.push(ratingItem);
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  await writeAll(items);

  res.status(201).json({ ok: true, id: ratingItem.id });
});

// --- API: lista betyg för subject ---
app.get('/api/ratings', async (req, res) => {
  const subject = normSubject(req.query.subject || '');
  if (!subject)
    return res.status(400).json({ ok: false, error: 'Ange subject i querystring.' });

  const items = await readAll();
  const list = items
    .filter((it) => it.subject === subject)
    .map(({ raterKey, proofHash, ...safe }) => safe);

  res.json({ ok: true, count: list.length, ratings: list });
});

// --- API: snitt ---
app.get('/api/ratings/average', async (req, res) => {
  const subject = normSubject(req.query.subject || '');
  if (!subject)
    return res.status(400).json({ ok: false, error: 'Ange subject i querystring.' });

  const items = await readAll();
  const mine = items.filter((it) => it.subject === subject);
  const avg = mine.length
    ? mine.reduce((s, it) => s + it.rating, 0) / mine.length
    : 0;

  res.json({
    ok: true,
    subject,
    count: mine.length,
    average: Number(avg.toFixed(2)),
  });
});

// --- API: senaste ---
app.get('/api/ratings/recent', async (_req, res) => {
  const items = await readAll();
  const list = items.slice(0, 20).map(({ raterKey, proofHash, ...safe }) => safe);
  res.json({ ok: true, ratings: list });
});

// --- Fallback: servera index.html för övriga paths (SPA) ---
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate MVP running on ${HOST}:${PORT}`);
});
