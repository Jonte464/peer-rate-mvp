// backend/routes/traderaRoutes.js
//
// API-endpoints för att hämta och synka Tradera-data till "Min profil".
// - summary: hämta lagrade ordrar
// - sync-now: (valfritt) scraping via Playwright
// - api-test: testa kontakt mot Tradera SOAP API
// - import-json: importera ordrar (t.ex. från lokalt script eller SOAP-anrop)
//
// Lagringslogiken ligger i backend/storage.tradera.js
// Import-logiken ligger i services/traderaService.js

const express = require('express');
const Joi = require('joi');

const { getTraderaSummaryBySubjectRef } = require('../storage.tradera');
const { normSubject } = require('../helpers');

const {
  syncTraderaForEmail,
  importTraderaOrdersForEmail,
} = require('../services/traderaService');

const { testApiConnection } = require('../services/traderaApiService');

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
    const subjectRef = normSubject(emailTrim);

    const summary = await getTraderaSummaryBySubjectRef(subjectRef, {
      limit,
    });

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
   GET /api/tradera/api-test
   Testar om vi kan nå Tradera SOAP API
   ------------------------------------------------------- */
router.get('/tradera/api-test', async (_req, res) => {
  try {
    const result = await testApiConnection();
    return res.json({ ok: true, message: 'API-anslutning OK', result });
  } catch (err) {
    console.error('[GET /api/tradera/api-test] error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Kunde inte ansluta till Tradera API',
      details: err?.message || 'Okänt fel',
    });
  }
});

/* -------------------------------------------------------
   POST /api/tradera/import-json
   Importera Tradera-ordrar "utifrån" utan att köra scraping i produktion.

   Tanken är att du kan:
   - köra ett lokalt script (Playwright eller SOAP)
   - hämta alla ordrar
   - skicka dem hit i JSON-format

   Body-exempel:
   {
     "email": "jonathan@example.com",
     "orders": [
       {
         "traderaOrderId": "123456",
         "traderaItemId": "987654",
         "title": "Sony WH-1000XM4",
         "amount": "1299.00",
         "currency": "SEK",
         "role": "BUYER",              // eller "SELLER"
         "counterpartyAlias": "Säljare123",
         "counterpartyEmail": "saljare@example.com",
         "completedAt": "2024-11-01T12:34:56Z"
       }
     ]
   }
   ------------------------------------------------------- */
const importBodySchema = Joi.object({
  email: Joi.string().email().required(),
  orders: Joi.array()
    .items(
      Joi.object({
        traderaOrderId: Joi.alternatives(
          Joi.string().min(1),
          Joi.number().integer()
        ).required(),
        traderaItemId: Joi.alternatives(
          Joi.string().allow(''),
          Joi.number().integer()
        ).optional(),
        title: Joi.string().allow('', null).optional(),
        amount: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        currency: Joi.string().max(10).optional(),
        role: Joi.string().valid('BUYER', 'SELLER').optional(),
        counterpartyAlias: Joi.string().allow('', null).optional(),
        counterpartyEmail: Joi.string().email().allow('', null).optional(),
        completedAt: Joi.string().allow('', null).optional(),
        // tillåt extra fält som vi bara stoppar i rawJson
      }).unknown(true)
    )
    .min(1)
    .required(),
});

router.post('/tradera/import-json', async (req, res) => {
  const { error, value } = importBodySchema.validate(req.body || {}, {
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      error: 'Ogiltigt format på Tradera-ordrar.',
      details: error.details.map((d) => d.message),
    });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();
  const orders = value.orders || [];

  try {
    const result = await importTraderaOrdersForEmail(emailTrim, orders);
    return res.json({
      ok: true,
      message: 'Tradera-ordrar importerade.',
      result,
    });
  } catch (e) {
    console.error('[POST /api/tradera/import-json] error:', e);
    return res.status(500).json({
      ok: false,
      error: e?.message || 'Kunde inte importera Tradera-ordrar.',
    });
  }
});

module.exports = router;
