// backend/routes/traderaRoutes.js
//
// API-endpoints för att hämta Tradera-data till "Min profil".
// Just nu: endast läsning (summary + orders) från vår egen databas.
// Själva inloggningen mot Tradera/Developer API bygger vi i ett senare steg.

const express = require('express');
const Joi = require('joi');
const { getTraderaSummaryBySubjectRef } = require('../storage');
const { normSubject } = require('../helpers');

const router = express.Router();

/**
 * Validering för queryparametrar:
 *  - email: kundens inloggningsmejl (krav)
 *  - limit: max antal affärer att hämta (frivillig, default 50)
 */
const summaryQuerySchema = Joi.object({
  email: Joi.string().email().required(),
  limit: Joi.number().integer().min(1).max(200).optional(),
});

/* -------------------------------------------------------
   GET /api/tradera/summary
   Hämta Tradera-sammanfattning + avslutade affärer för en kund.

   Anropas från "Min profil" i frontend, t.ex:
   /api/tradera/summary?email=kundensmejl@example.com

   Svarsexempel:
   {
     ok: true,
     hasTradera: true,
     profile: {
       username: "...",
       email: "...",
       externalUserId: "...",
       accountCreatedAt: "...",
       feedbackScore: 4.9,
       feedbackCountPositive: 120,
       feedbackCountNegative: 3,
       lastSyncedAt: "2025-11-28T10:00:00.000Z"
     },
     orders: [
       {
         id: "...",
         traderaOrderId: "...",
         traderaItemId: "...",
         title: "iPhone 13",
         amount: "2500.00",
         currency: "SEK",
         role: "SELLER",
         counterpartyAlias: "köpar123",
         counterpartyEmail: null,
         completedAt: "2025-10-01T12:34:00.000Z"
       },
       ...
     ]
   }
   ------------------------------------------------------- */
router.get('/tradera/summary', async (req, res) => {
  const { error, value } = summaryQuerySchema.validate(req.query);

  if (error) {
    return res.status(400).json({
      ok: false,
      error: 'Ogiltiga parametrar. Kontrollera att e-post är korrekt angiven.',
    });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();
  const limit = value.limit;

  try {
    // Vi använder samma normalisering som vid registrering/login.
    const subjectRef = normSubject(emailTrim);

    const summary = await getTraderaSummaryBySubjectRef(subjectRef, {
      limit,
    });

    return res.json({
      ok: true,
      hasTradera: summary.hasTradera,
      profile: summary.profile,
      orders: summary.orders,
    });
  } catch (e) {
    console.error('[GET /api/tradera/summary] error:', e);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hämta Tradera-data.' });
  }
});

module.exports = router;
