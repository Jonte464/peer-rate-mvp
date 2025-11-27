// backend/routes/ratingsRoutes.js

const express = require('express');
const Joi = require('joi');

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
  source: Joi.string().allow('', null), // källa (Blocket, Tradera, ...)
  report: reportSchema.optional(),
});

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

  try {
    const { customerId, ratingId } = await createRating({
      subjectRef,
      rating,
      comment,
      raterName,
      proofRef,
      createdAt: nowIso(),
      ratingSource, // viktigt
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

/* -------------------------------------------------------
   GET /api/ratings/average – snitt
   ------------------------------------------------------- */
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

/* -------------------------------------------------------
   GET /api/ratings/recent – senaste globalt
   ------------------------------------------------------- */
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
