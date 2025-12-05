// backend/routes/traderaRoutes.js
//
// API-endpoints för att hämta och synka Tradera-data till "Min profil".
//
// Lagringslogiken ligger i backend/storage.tradera.js
// Scraping-/import-logik ligger i services/traderaService.js

const express = require('express');
const Joi = require('joi');

// 🔁 Viktigt: hämta från storage.tradera.js (nya filen)
const { getTraderaSummaryBySubjectRef } = require('../storage.tradera');

const { normSubject } = require('../helpers');
const {
  syncTraderaForEmail,
  importTraderaOrdersForEmail,
} = require('../services/traderaService');

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

    // Skicka vidare hela objektet (hasTradera, profile, orders, summary)
    return res.json({
      ok: true,
      ...summary,
    });
  } catch (e) {
    console.error('[GET /api/tradera/summary] error:', e);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hämta Tradera-data.' });
  }
});

/* -------------------------------------------------------
   POST /api/tradera/sync-now
   Trigga en "live"-synk från Tradera via scrapern.

   Body:
   {
     "email": "kundensmejl@example.com"
   }

   Returnerar t.ex.:
   {
     ok: true,
     result: {
       ok: true/false,
       created: 3,
       updated: 1,
       totalScraped: 4,
       message?: "..."
     }
   }
   ------------------------------------------------------- */
const syncBodySchema = Joi.object({
  email: Joi.string().email().required(),
});

router.post('/tradera/sync-now', async (req, res) => {
  const { error, value } = syncBodySchema.validate(req.body || {});
  if (error) {
    return res.status(400).json({
      ok: false,
      error: 'Ogiltig body. E-post krävs för att synka Tradera.',
    });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();

  try {
    const result = await syncTraderaForEmail(emailTrim);
    return res.json({ ok: true, result });
  } catch (e) {
    console.error('[POST /api/tradera/sync-now] error:', e);
    return res.status(500).json({
      ok: false,
      error:
        e && e.message
          ? e.message
          : 'Kunde inte synka Tradera-data just nu.',
    });
  }
});

/* -------------------------------------------------------
   POST /api/tradera/import-json
   Importera Tradera-ordrar via JSON (t.ex. från Tradera API eller
   ett lokalt script).

   Body:
   {
     "email": "kundensmejl@example.com",
     "orders": [
       {
         "traderaOrderId": "12345",
         "traderaItemId": "98765",
         "title": "Artikel",
         "amount": 123.45,
         "currency": "SEK",
         "role": "BUYER" | "SELLER",
         "counterpartyAlias": "...",
         "counterpartyEmail": "...",
         "completedAt": "2024-01-01T12:34:56Z",
         "rawJson": { ... valfri extra data ... }
       },
       ...
     ]
   }
   ------------------------------------------------------- */

const importBodySchema = Joi.object({
  email: Joi.string().email().required(),
  orders: Joi.array().items(Joi.object().unknown(true)).min(1).required(),
});

router.post('/tradera/import-json', async (req, res) => {
  const { error, value } = importBodySchema.validate(req.body || {});
  if (error) {
    return res.status(400).json({
      ok: false,
      error: 'Ogiltig body. E-post och minst en order krävs.',
      details: error.details?.map((d) => d.message),
    });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();
  const orders = value.orders;

  try {
    const result = await importTraderaOrdersForEmail(emailTrim, orders);
    return res.json({
      ok: true,
      result,
    });
  } catch (e) {
    console.error('[POST /api/tradera/import-json] error:', e);
    return res.status(500).json({
      ok: false,
      error:
        e && e.message
          ? e.message
          : 'Kunde inte importera Tradera-ordrar just nu.',
    });
  }
});

module.exports = router;
