// backend/routes/ratingsRoutes.js

const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const {
  createRating,
  createReport,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,
} = require('../storage');

const { nowIso, normSubject, mapReportReason } = require('../helpers');

const router = express.Router();

/** Mappa svensk benämning -> enum RatingSource */
function mapRatingSource(input) {
  if (!input) return 'OTHER';
  const v = String(input).trim().toLowerCase();

  if (v.includes('blocket')) return 'BLOCKET';
  if (v.includes('tradera')) return 'TRADERA';
  if (v.includes('airbnb')) return 'AIRBNB';
  if (v.includes('husknuten')) return 'HUSKNUTEN';
  if (v.includes('tiptap')) return 'TIPTAP';

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

// “kundakt”-underlag från extension
const counterpartySchema = Joi.object({
  email: Joi.string().email().required(),

  // OBS: ibland skickar extension/ratingForm "username" istället för "platformUsername"
  username: Joi.string().max(60).allow('', null),
  platformUsername: Joi.string().max(60).allow('', null),

  name: Joi.string().max(120).allow('', null),
  phone: Joi.string().max(40).allow('', null),
  addressStreet: Joi.string().max(120).allow('', null),
  addressZip: Joi.string().max(20).allow('', null),
  addressCity: Joi.string().max(80).allow('', null),
  country: Joi.string().max(60).allow('', null),

  platform: Joi.string().max(30).allow('', null), // "TRADERA"
  pageUrl: Joi.string().uri().allow('', null),

  orderId: Joi.string().max(80).allow('', null),
  itemId: Joi.string().max(80).allow('', null),
  amountSek: Joi.number().integer().min(0).max(100000000).allow(null),
  title: Joi.string().max(200).allow('', null),
}).unknown(true).optional();

// “deal”-underlag från extension (verifierad affär)
const dealSchema = Joi.object({
  platform: Joi.string().max(30).allow('', null), // "TRADERA"
  orderId: Joi.string().max(80).allow('', null),
  itemId: Joi.string().max(80).allow('', null),
  title: Joi.string().max(200).allow('', null),
  amount: Joi.alternatives(Joi.number(), Joi.string()).allow(null),
  amountSek: Joi.number().integer().min(0).max(100000000).allow(null),
  currency: Joi.string().max(10).allow('', null),
  date: Joi.string().max(40).allow('', null),
  dateISO: Joi.string().max(40).allow('', null),
  pageUrl: Joi.string().uri().allow('', null),
}).unknown(true).optional();

const createRatingSchema = Joi.object({
  subject: Joi.string().min(2).max(200).required(),
  rater: Joi.string().min(2).max(200).allow('', null).optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('', null),
  proofRef: Joi.string().max(200).allow('', null),
  source: Joi.string().allow('', null), // källa (Blocket, Tradera, ...)

  report: reportSchema.optional(),
  counterparty: counterpartySchema,
  deal: dealSchema,
}).unknown(true); // ✅ viktigt: stoppa inte framtida fält

function looksLikePhone(s) {
  const v = String(s || '').trim();
  if (!v) return false;
  // enkel heuristik: innehåller siffror och minst 6 siffror totalt
  const digits = v.replace(/\D/g, '');
  return digits.length >= 6;
}

async function upsertCounterpartyDossier(counterparty) {
  if (!counterparty || !counterparty.email) return;

  // ✅ Rädda felmappning: om name råkar vara telefon och phone saknas
  const cp = { ...counterparty };
  if ((!cp.phone || !String(cp.phone).trim()) && looksLikePhone(cp.name)) {
    cp.phone = cp.name;
    cp.name = null;
  }

  const subjectRef = normSubject(cp.email);
  if (!subjectRef) return;

  // 1) Kund (Customer) – fyll på endast om fält saknas
  const existing = await prisma.customer.findUnique({ where: { subjectRef } });

  if (!existing) {
    await prisma.customer.create({
      data: {
        subjectRef,
        email: cp.email.toLowerCase(),
        fullName: cp.name || null,
        phone: cp.phone || null,
        addressStreet: cp.addressStreet || null,
        addressZip: cp.addressZip || null,
        addressCity: cp.addressCity || null,
        country: cp.country || 'SE',
      },
    });
  } else {
    const dataToUpdate = {};
    if (!existing.email) dataToUpdate.email = cp.email.toLowerCase();
    if (!existing.fullName && cp.name) dataToUpdate.fullName = cp.name;
    if (!existing.phone && cp.phone) dataToUpdate.phone = cp.phone;
    if (!existing.addressStreet && cp.addressStreet) dataToUpdate.addressStreet = cp.addressStreet;
    if (!existing.addressZip && cp.addressZip) dataToUpdate.addressZip = cp.addressZip;
    if (!existing.addressCity && cp.addressCity) dataToUpdate.addressCity = cp.addressCity;
    if (!existing.country && cp.country) dataToUpdate.country = cp.country;

    if (Object.keys(dataToUpdate).length) {
      await prisma.customer.update({ where: { subjectRef }, data: dataToUpdate });
    }
  }

  // 2) Extern profil (ExternalProfile) – om vi har username
  const platform = (cp.platform || '').toString().toUpperCase();
  const username = cp.platformUsername || cp.username || null;

  if (platform === 'TRADERA' && username) {
    const customer = await prisma.customer.findUnique({ where: { subjectRef } });
    if (customer) {
      const found = await prisma.externalProfile.findFirst({
        where: { customerId: customer.id, platform: 'TRADERA', username },
      });

      if (!found) {
        await prisma.externalProfile.create({
          data: {
            customerId: customer.id,
            platform: 'TRADERA',
            username,
            profileJson: cp.pageUrl ? { pageUrl: cp.pageUrl } : undefined,
          },
        });
      }
    }
  }
}

/* -------------------------------------------------------
   POST /api/ratings – skapa betyg
   ------------------------------------------------------- */
router.post('/ratings', async (req, res) => {
  const { error, value } = createRatingSchema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      ok: false,
      error: 'Ogiltig inmatning',
      details: error.details,
    });
  }

  const subjectRef = normSubject(value.subject);
  const rating = value.rating;
  const comment = (value.comment || '').toString().trim();
  const raterRaw = (value.rater || '').toString().trim() || null;
  const proofRef = (value.proofRef || '').toString().trim() || null;

  const ratingSource = mapRatingSource(value.source);

  // Säkerhet: om counterparty skickas måste subject matcha counterparty.email
  if (value.counterparty?.email) {
    const a = normSubject(value.subject);
    const b = normSubject(value.counterparty.email);
    if (a && b && a !== b) {
      return res.status(400).json({
        ok: false,
        error: 'Subject matchar inte counterparty.email (säkerhetskontroll).',
      });
    }
  }

  try {
    // 1) skapa rating
    // OBS: just nu lagras raterRaw i raterName (legacy). Vi kan förbättra senare
    const { customerId, ratingId } = await createRating({
      subjectRef,
      rating,
      comment,
      raterName: raterRaw,
      proofRef,
      createdAt: nowIso(),
      ratingSource,
    });

    // 2) spara kundakt (motpart) om vi fick in data från extension
    if (value.counterparty) {
      await upsertCounterpartyDossier(value.counterparty);
    }

    // 3) ev report
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
   GET /api/ratings – lista betyg för subject
   ------------------------------------------------------- */
router.get('/ratings', async (req, res) => {
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

router.get('/ratings/average', async (req, res) => {
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

router.get('/ratings/recent', async (_req, res) => {
  try {
    const list = await listRecentRatings(20);
    res.json({ ok: true, ratings: list });
  } catch (e) {
    console.error('[GET /api/ratings/recent] error:', e);
    res.status(500).json({ ok: false, error: 'Kunde inte hämta senaste' });
  }
});

module.exports = router;
