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

const {
  nowIso,
  normSubject,
  mapReportReason,
} = require('../helpers');

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

function safeIsoToDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toDecimalAmount(amountSek) {
  if (amountSek === null || amountSek === undefined) return null;
  const n = Number(amountSek);
  if (Number.isNaN(n)) return null;
  // Prisma Decimal kan ta number/string; vi skickar string för stabilitet
  return String(n.toFixed(2));
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
  phone: Joi.string().max(80).allow('', null),

  addressStreet: Joi.string().max(120).allow('', null),
  addressZip: Joi.string().max(20).allow('', null),
  addressCity: Joi.string().max(80).allow('', null),
  country: Joi.string().max(60).allow('', null),

  platform: Joi.string().max(30).allow('', null),          // "TRADERA"
  platformUsername: Joi.string().max(80).allow('', null),  // alias om vi hittar
  pageUrl: Joi.string().uri().allow('', null),

  orderId: Joi.string().max(80).allow('', null),
  itemId: Joi.string().max(80).allow('', null),

  amountSek: Joi.number().min(0).max(100000000).allow(null),
  currency: Joi.string().max(10).allow('', null),

  // Viktigt: extension kan skicka dateISO / completedAt (ISO-sträng)
  dateISO: Joi.string().max(40).allow('', null),
  completedAt: Joi.string().max(40).allow('', null),

  title: Joi.string().max(200).allow('', null),
}).optional();

const createRatingSchema = Joi.object({
  subject: Joi.string().min(2).max(200).required(),
  rater: Joi.string().min(2).max(200).allow('', null).optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('', null),
  proofRef: Joi.string().max(200).allow('', null),
  source: Joi.string().allow('', null), // källa (Blocket, Tradera, ...)
  report: reportSchema.optional(),
  counterparty: counterpartySchema,
});

async function upsertCounterpartyDossier(counterparty) {
  if (!counterparty || !counterparty.email) return null;

  const subjectRef = normSubject(counterparty.email);
  if (!subjectRef) return null;

  // 1) Kund (Customer) – fyll på endast om fält saknas (förstör inte befintlig data)
  const existing = await prisma.customer.findUnique({
    where: { subjectRef },
  });

  if (!existing) {
    const created = await prisma.customer.create({
      data: {
        subjectRef,
        email: counterparty.email.toLowerCase(),
        fullName: counterparty.name || null,
        phone: counterparty.phone || null,
        addressStreet: counterparty.addressStreet || null,
        addressZip: counterparty.addressZip || null,
        addressCity: counterparty.addressCity || null,
        country: counterparty.country || 'SE',
        // passwordHash lämnas null => “presumtiv”
      },
    });

    // 2) Extern profil (ExternalProfile) – om vi har username
    if (
      counterparty.platform &&
      String(counterparty.platform).toUpperCase() === 'TRADERA' &&
      counterparty.platformUsername
    ) {
      await prisma.externalProfile.create({
        data: {
          customerId: created.id,
          platform: 'TRADERA',
          username: counterparty.platformUsername,
          profileJson: counterparty.pageUrl ? { pageUrl: counterparty.pageUrl } : undefined,
        }
      });
    }

    return created;
  }

  // update only missing
  const dataToUpdate = {};
  if (!existing.email) dataToUpdate.email = counterparty.email.toLowerCase();
  if (!existing.fullName && counterparty.name) dataToUpdate.fullName = counterparty.name;
  if (!existing.phone && counterparty.phone) dataToUpdate.phone = counterparty.phone;
  if (!existing.addressStreet && counterparty.addressStreet) dataToUpdate.addressStreet = counterparty.addressStreet;
  if (!existing.addressZip && counterparty.addressZip) dataToUpdate.addressZip = counterparty.addressZip;
  if (!existing.addressCity && counterparty.addressCity) dataToUpdate.addressCity = counterparty.addressCity;
  if (!existing.country && counterparty.country) dataToUpdate.country = counterparty.country;

  const updated = Object.keys(dataToUpdate).length
    ? await prisma.customer.update({ where: { subjectRef }, data: dataToUpdate })
    : existing;

  // 2) Extern profil (ExternalProfile) – om vi har username och den saknas
  if (
    counterparty.platform &&
    String(counterparty.platform).toUpperCase() === 'TRADERA' &&
    counterparty.platformUsername
  ) {
    const found = await prisma.externalProfile.findFirst({
      where: {
        customerId: updated.id,
        platform: 'TRADERA',
        username: counterparty.platformUsername,
      }
    });

    if (!found) {
      await prisma.externalProfile.create({
        data: {
          customerId: updated.id,
          platform: 'TRADERA',
          username: counterparty.platformUsername,
          profileJson: counterparty.pageUrl ? { pageUrl: counterparty.pageUrl } : undefined,
        }
      });
    }
  }

  return updated;
}

async function createTransactionFromCounterparty(customerId, counterparty, proofRef) {
  if (!customerId) return null;
  if (!counterparty) return null;

  const occurredAt =
    safeIsoToDate(counterparty.completedAt) ||
    safeIsoToDate(counterparty.dateISO) ||
    null;

  const externalRef =
    (counterparty.orderId || '').toString().trim() ||
    (proofRef || '').toString().trim() ||
    null;

  const evidenceUrl =
    (counterparty.pageUrl || '').toString().trim() ||
    null;

  const currency =
    (counterparty.currency || '').toString().trim() ||
    'SEK';

  const amount = toDecimalAmount(counterparty.amountSek);

  // Om vi inte har någon hård data alls: skapa inte transaction
  if (!externalRef && !evidenceUrl && !occurredAt && amount === null) {
    return null;
  }

  const tx = await prisma.transaction.create({
    data: {
      customerId,
      amount: amount,
      currency,
      occurredAt,
      externalRef,
      evidenceUrl,
    }
  });

  return tx;
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
    // 1) skapa rating (som tidigare)
    const { customerId, ratingId } = await createRating({
      subjectRef,
      rating,
      comment,
      raterName,
      proofRef,
      createdAt: nowIso(),
      ratingSource,
    });

    // 2) spara kundakt (motpart) + skapa transaction med belopp/datum/order/url
    let tx = null;
    if (value.counterparty) {
      const cpCustomer = await upsertCounterpartyDossier(value.counterparty);

      // Om createRating skapade rating mot en viss customerId (subject),
      // då är det den vi vill sätta transaction på.
      // (cpCustomer.id bör matcha customerId om subject=email=counterparty.email)
      const subjectCustomerId = cpCustomer?.id || customerId;

      tx = await createTransactionFromCounterparty(subjectCustomerId, value.counterparty, proofRef);

      if (tx?.id) {
        await prisma.rating.update({
          where: { id: ratingId },
          data: {
            transactionId: tx.id,
            verificationId: value.counterparty.orderId || proofRef || null,
            // proofRef finns redan ofta, men safe:
            proofRef: proofRef || value.counterparty.orderId || null,
          }
        });
      } else {
        // ändå sätt verificationId om vi har orderId
        if (value.counterparty.orderId && !proofRef) {
          await prisma.rating.update({
            where: { id: ratingId },
            data: { verificationId: value.counterparty.orderId }
          });
        }
      }
    }

    // 3) ev report
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

    return res.status(201).json({ ok: true, transactionId: tx?.id || null });
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
