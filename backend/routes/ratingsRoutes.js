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

const { saveTraderaOrders } = require('../storage.tradera');

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

function isEmail(s) {
  if (!s) return false;
  const v = String(s).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function toDateOrNull(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;

  // Om vi får "YYYY-MM-DD" gör vi en stabil Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmount(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return null;
  // "47", "47.00", "47,00", "1 299,50"
  const normalized = s.replace(/\s+/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
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
  name: Joi.string().max(120).allow('', null),
  phone: Joi.string().max(40).allow('', null),
  addressStreet: Joi.string().max(120).allow('', null),
  addressZip: Joi.string().max(20).allow('', null),
  addressCity: Joi.string().max(80).allow('', null),
  country: Joi.string().max(60).allow('', null),

  platform: Joi.string().max(30).allow('', null),          // "TRADERA"
  platformUsername: Joi.string().max(60).allow('', null),  // alias om vi hittar
  pageUrl: Joi.string().uri().allow('', null),

  orderId: Joi.string().max(80).allow('', null),
  itemId: Joi.string().max(80).allow('', null),
  amountSek: Joi.number().integer().min(0).max(100000000).allow(null),
  title: Joi.string().max(200).allow('', null),

  // (nytt) datum från extension om vi får det
  date: Joi.string().max(40).allow('', null),
  dateISO: Joi.string().max(60).allow('', null),
}).optional();

// Verified deal (kan komma separat från counterparty)
const dealSchema = Joi.object({
  platform: Joi.string().max(30).allow('', null),      // "TRADERA"
  source: Joi.string().max(30).allow('', null),        // "Tradera"
  pageUrl: Joi.string().uri().allow('', null),

  orderId: Joi.string().max(80).allow('', null),
  itemId: Joi.string().max(80).allow('', null),
  title: Joi.string().max(200).allow('', null),

  amount: Joi.alternatives(Joi.number(), Joi.string()).allow(null),
  amountSek: Joi.alternatives(Joi.number(), Joi.string()).allow(null),
  currency: Joi.string().max(10).allow('', null),

  date: Joi.string().max(40).allow('', null),
  dateISO: Joi.string().max(60).allow('', null),
  completedAt: Joi.string().max(60).allow('', null),

  // kan innehålla counterparty också
  counterparty: Joi.object({
    email: Joi.string().email().allow('', null),
    username: Joi.string().max(80).allow('', null),
    phone: Joi.string().max(40).allow('', null),
  }).unknown(true).allow(null),
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
}).unknown(true);

async function upsertCounterpartyDossier(counterparty) {
  if (!counterparty || !counterparty.email) return;

  const subjectRef = normSubject(counterparty.email);
  if (!subjectRef) return;

  // 1) Kund (Customer) – fyll på endast om fält saknas (förstör inte befintlig data)
  const existing = await prisma.customer.findUnique({
    where: { subjectRef },
  });

  if (!existing) {
    await prisma.customer.create({
      data: {
        subjectRef,
        email: counterparty.email.toLowerCase(),
        fullName: counterparty.name || null,
        phone: counterparty.phone || null,
        addressStreet: counterparty.addressStreet || null,
        addressZip: counterparty.addressZip || null,
        addressCity: counterparty.addressCity || null,
        country: counterparty.country || 'SE',
      },
    });
  } else {
    const dataToUpdate = {};
    if (!existing.email) dataToUpdate.email = counterparty.email.toLowerCase();
    if (!existing.fullName && counterparty.name) dataToUpdate.fullName = counterparty.name;
    if (!existing.phone && counterparty.phone) dataToUpdate.phone = counterparty.phone;
    if (!existing.addressStreet && counterparty.addressStreet) dataToUpdate.addressStreet = counterparty.addressStreet;
    if (!existing.addressZip && counterparty.addressZip) dataToUpdate.addressZip = counterparty.addressZip;
    if (!existing.addressCity && counterparty.addressCity) dataToUpdate.addressCity = counterparty.addressCity;
    if (!existing.country && counterparty.country) dataToUpdate.country = counterparty.country;

    if (Object.keys(dataToUpdate).length) {
      await prisma.customer.update({
        where: { subjectRef },
        data: dataToUpdate,
      });
    }
  }

  // 2) Extern profil (ExternalProfile) – om vi har username
  if (counterparty.platform && String(counterparty.platform).toUpperCase() === 'TRADERA' && counterparty.platformUsername) {
    const customer = await prisma.customer.findUnique({ where: { subjectRef } });
    if (customer) {
      const found = await prisma.externalProfile.findFirst({
        where: {
          customerId: customer.id,
          platform: 'TRADERA',
          username: counterparty.platformUsername,
        }
      });

      if (!found) {
        await prisma.externalProfile.create({
          data: {
            customerId: customer.id,
            platform: 'TRADERA',
            username: counterparty.platformUsername,
            profileJson: counterparty.pageUrl ? { pageUrl: counterparty.pageUrl } : undefined,
          }
        });
      }
    }
  }
}

/**
 * ✅ NYTT: Spara "verified deal" för den som lämnar betyget (rater)
 * som en TraderaOrder (kopplad till raterns ExternalProfile/TRADERA)
 */
async function upsertVerifiedDealForRater({ ratingSource, raterEmail, subjectEmail, counterparty, deal }) {
  // Vi gör endast detta för TRADERA i MVP
  if (ratingSource !== 'TRADERA') return;

  const rater = (raterEmail || '').trim().toLowerCase();
  if (!isEmail(rater)) return;

  const raterRef = normSubject(rater);
  if (!raterRef) return;

  // Hitta/skapa rater som customer (shadow ok)
  const raterCustomer = await prisma.customer.upsert({
    where: { subjectRef: raterRef },
    update: { email: rater }, // harmless (om email redan finns)
    create: { subjectRef: raterRef, email: rater },
    select: { id: true },
  });

  // Hitta/skapa ExternalProfile(TRADERA) för rater
  let profile = await prisma.externalProfile.findFirst({
    where: { customerId: raterCustomer.id, platform: 'TRADERA' },
  });

  if (!profile) {
    profile = await prisma.externalProfile.create({
      data: {
        customerId: raterCustomer.id,
        platform: 'TRADERA',
        username: rater, // placeholder tills vi har riktig username
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
      },
    });
  }

  // Normalisera deal-fält
  const d = deal || {};
  const cp = (d.counterparty && typeof d.counterparty === 'object') ? d.counterparty : (counterparty || {});

  const orderId = (d.orderId || counterparty?.orderId || '').toString().trim();
  if (!orderId) return; // inget att spara

  const itemId = (d.itemId || counterparty?.itemId || null);
  const title = (d.title || counterparty?.title || null);

  const amount = parseAmount(d.amount ?? d.amountSek ?? counterparty?.amountSek ?? null);
  const currency = (d.currency || 'SEK').toString().trim().toUpperCase() || 'SEK';

  const completedAt =
    toDateOrNull(d.completedAt) ||
    toDateOrNull(d.dateISO) ||
    toDateOrNull(d.date) ||
    toDateOrNull(counterparty?.dateISO) ||
    toDateOrNull(counterparty?.date) ||
    null;

  const counterpartyEmail =
    (cp?.email || subjectEmail || counterparty?.email || '').toString().trim().toLowerCase() || null;

  const rawJson = {
    source: 'rating-submit',
    capturedAt: new Date().toISOString(),
    pageUrl: d.pageUrl || counterparty?.pageUrl || null,
    phone: cp?.phone || counterparty?.phone || null,
    original: { deal: d, counterparty },
  };

  // Spara via gemensam storage-funktion (hanterar update/create)
  await saveTraderaOrders(profile.id, [
    {
      traderaOrderId: orderId,
      traderaItemId: itemId || null,
      title: title || '(verifierad affär)',
      amount: amount != null ? String(amount) : null,
      currency,
      role: 'BUYER', // ok som default i MVP (kan förbättras senare)
      counterpartyAlias: cp?.username || null,
      counterpartyEmail,
      completedAt: completedAt ? completedAt.toISOString() : null,
      rawJson,
    },
  ]);
}

/* -------------------------------------------------------
   POST /api/ratings – skapa betyg
   ------------------------------------------------------- */
router.post('/ratings', async (req, res) => {
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

  // Mappa text i rullistan -> enum
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
    const { customerId, ratingId } = await createRating({
      subjectRef,
      rating,
      comment,
      raterName,
      proofRef,
      createdAt: nowIso(),
      ratingSource,
    });

    // 2) spara kundakt (motpart)
    if (value.counterparty) {
      await upsertCounterpartyDossier(value.counterparty);
    }

    // 3) ✅ spara verified deal (för rater) om vi fick tillräckligt
    //    Vi använder "rater" (email) från payload som identifierare i MVP.
    //    (Senare kan vi koppla detta till riktig auth-session.)
    await upsertVerifiedDealForRater({
      ratingSource,
      raterEmail: value.rater,              // frontend skickar user.email här
      subjectEmail: value.subject,          // motpartens email
      counterparty: value.counterparty || null,
      deal: value.deal || null,
    });

    // 4) ev report
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

/* -------------------------------------------------------
   GET /api/ratings – lista betyg för subject
   ------------------------------------------------------- */
router.get('/ratings', async (req, res) => {
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

router.get('/ratings/average', async (req, res) => {
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

router.get('/ratings/recent', async (_req, res) => {
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

module.exports = router;
