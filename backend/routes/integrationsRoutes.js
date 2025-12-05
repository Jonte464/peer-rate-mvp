// backend/routes/integrationsRoutes.js 
// Hanterar integrationer: Tradera (koppling, summary, mock, sync, import) + eBay (auth-skelett)

const express = require('express');
const { PrismaClient } = require('@prisma/client');

// Kryptering för Tradera-lösenord
const { encryptSecret } = require('../services/secretService');
// Tradera-service: sync + import
const {
  syncTraderaForEmail,
  importTraderaOrdersForEmail,
} = require('../services/traderaService');

// eBay-service: auth-URL + callback-hantering (MVP-skelett)
const {
  buildEbayAuthUrlForCustomer,
  handleEbayCallback,
} = require('../services/ebayService');

const prisma = new PrismaClient();
const router = express.Router();

/* -------------------------------------------------------
   Tradera-koppling – sparar användarnamn + krypterat lösenord (valfritt)
   ------------------------------------------------------- */
router.post('/tradera/connect', async (req, res) => {
  try {
    const body = req.body || {};
    const emailTrim = String(body.email || '').trim().toLowerCase();
    const usernameTrim = String(body.username || '').trim();
    const passwordRaw = String(body.password || '').trim();

    if (!emailTrim || !usernameTrim) {
      return res
        .status(400)
        .json({ ok: false, error: 'Saknar e-post eller Tradera-användarnamn.' });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ subjectRef: emailTrim }, { email: emailTrim }],
      },
    });

    if (!customer) {
      return res
        .status(404)
        .json({ ok: false, error: 'Kund hittades inte.' });
    }

    // Kryptera lösenordet om vi har ett
    const encryptedPassword = passwordRaw ? encryptSecret(passwordRaw) : null;

    let profile = await prisma.externalProfile.findFirst({
      where: {
        customerId: customer.id,
        platform: 'TRADERA',
      },
    });

    const dataUpdate = {
      username: usernameTrim,
      status: 'ACTIVE',
    };

    if (encryptedPassword) {
      dataUpdate.encryptedPassword = encryptedPassword;
    }

    if (profile) {
      profile = await prisma.externalProfile.update({
        where: { id: profile.id },
        data: dataUpdate,
      });
    } else {
      profile = await prisma.externalProfile.create({
        data: {
          customerId: customer.id,
          platform: 'TRADERA',
          ...dataUpdate,
        },
      });
    }

    return res.json({ ok: true, profileId: profile.id });
  } catch (err) {
    console.error('Tradera connect error', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte koppla Tradera-konto.' });
  }
});

/* -------------------------------------------------------
   Tradera-summary – hämtar profil + sparade TraderaOrder-rader
   + markerar vilka affärer som redan har omdömen
   ------------------------------------------------------- */
router.get('/tradera/summary', async (req, res) => {
  try {
    const emailQ = String(req.query.email || '').trim().toLowerCase();
    const limitRaw = Number(req.query.limit || 50);
    const limit = Math.max(
      1,
      Math.min(200, Number.isNaN(limitRaw) ? 50 : limitRaw)
    );

    if (!emailQ) {
      return res.status(400).json({ ok: false, error: 'Saknar email' });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ subjectRef: emailQ }, { email: emailQ }],
      },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    const profile = await prisma.externalProfile.findFirst({
      where: {
        customerId: customer.id,
        platform: 'TRADERA',
      },
    });

    if (!profile) {
      return res.json({
        ok: true,
        hasTradera: false,
        profile: null,
        orders: [],
        summary: {
          totalOrders: 0,
          ratedOrders: 0,
          unratedOrders: 0,
        },
      });
    }

    const ordersRaw = await prisma.traderaOrder.findMany({
      where: { externalProfileId: profile.id },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    const traderaIds = ordersRaw
      .map((o) => o.traderaOrderId)
      .filter((id) => !!id);

    let ratingMap = new Map();
    if (traderaIds.length > 0) {
      const ratings = await prisma.rating.findMany({
        where: {
          proofRef: { in: traderaIds },
        },
        select: { id: true, proofRef: true },
      });

      ratingMap = new Map();
      for (const r of ratings) {
        if (!r.proofRef) continue;
        ratingMap.set(r.proofRef, true);
      }
    }

    const orders = ordersRaw.map((o) => ({
      id: o.id,
      traderaOrderId: o.traderaOrderId,
      title: o.title,
      role: o.role,
      amount: o.amount ? o.amount.toString() : null,
      currency: o.currency || 'SEK',
      counterpartyAlias: o.counterpartyAlias,
      counterpartyEmail: o.counterpartyEmail,
      completedAt: o.completedAt,
      hasRating: !!(o.traderaOrderId && ratingMap.get(o.traderaOrderId)),
    }));

    const totalOrders = orders.length;
    const ratedOrders = orders.filter((o) => o.hasRating).length;
    const unratedOrders = Math.max(0, totalOrders - ratedOrders);

    const dtoProfile = {
      username: profile.username,
      email: null,
      externalUserId: profile.externalUserId || null,
      accountCreatedAt: null,
      feedbackScore: null,
      feedbackCountPositive: null,
      feedbackCountNegative: null,
      lastSyncedAt: profile.lastSyncedAt,
    };

    return res.json({
      ok: true,
      hasTradera: true,
      profile: dtoProfile,
      orders,
      limit,
      summary: {
        totalOrders,
        ratedOrders,
        unratedOrders,
      },
    });
  } catch (err) {
    console.error('Tradera summary error', err);
    return res.status(500).json({
      ok: false,
      error: 'Serverfel vid hämtning av Tradera-data',
    });
  }
});

/* -------------------------------------------------------
   Tradera MOCK: skapa några testordrar för den kopplade profilen
   (används bara för att testa UI/databaskedjan)
   ------------------------------------------------------- */
router.post('/tradera/mock-orders', async (req, res) => {
  try {
    const emailQ = String(req.body.email || '').trim().toLowerCase();

    if (!emailQ) {
      return res
        .status(400)
        .json({ ok: false, error: 'Saknar email i request body.' });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ subjectRef: emailQ }, { email: emailQ }],
      },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    const profile = await prisma.externalProfile.findFirst({
      where: {
        customerId: customer.id,
        platform: 'TRADERA',
      },
    });

    if (!profile) {
      return res.status(400).json({
        ok: false,
        error: 'Ingen Tradera-profil kopplad till denna kund.',
      });
    }

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    // Rensa ev. gamla mock-ordrar för att undvika dubletter
    await prisma.traderaOrder.deleteMany({
      where: { externalProfileId: profile.id },
    });

    // Skapa några exempelordrar
    const created = await prisma.traderaOrder.createMany({
      data: [
        {
          externalProfileId: profile.id,
          traderaOrderId: 'MOCK-' + Date.now() + '-1',
          traderaItemId: 'ITEM-123',
          title: 'Mock: Nintendo Switch-spel',
          amount: 350,
          currency: 'SEK',
          role: 'SELLER',
          counterpartyAlias: 'Köpare123',
          counterpartyEmail: 'kopare@example.com',
          completedAt: twoDaysAgo,
          rawJson: {},
        },
        {
          externalProfileId: profile.id,
          traderaOrderId: 'MOCK-' + Date.now() + '-2',
          traderaItemId: 'ITEM-456',
          title: 'Mock: Lego-paket',
          amount: 220,
          currency: 'SEK',
          role: 'BUYER',
          counterpartyAlias: 'SäljareABC',
          counterpartyEmail: 'saljare@example.com',
          completedAt: tenDaysAgo,
          rawJson: {},
        },
      ],
    });

    return res.json({
      ok: true,
      createdCount: created.count || 0,
    });
  } catch (err) {
    console.error('Tradera mock-orders error', err);
    return res.status(500).json({
      ok: false,
      error: 'Kunde inte skapa mock-Traderaordrar.',
    });
  }
});

/* -------------------------------------------------------
   Tradera SYNC-NOW – placeholder sync (ingen riktig scraping i PROD)
   ------------------------------------------------------- */
router.post('/tradera/sync-now', async (req, res) => {
  try {
    const emailQ = String(req.body.email || '').trim().toLowerCase();

    if (!emailQ) {
      return res
        .status(400)
        .json({ ok: false, error: 'Saknar email i request body.' });
    }

    const result = await syncTraderaForEmail(emailQ);

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error('Tradera sync-now error', err);
    return res.status(500).json({
      ok: false,
      error:
        err && err.message ? err.message : 'Kunde inte synka Tradera-data.',
    });
  }
});

/* -------------------------------------------------------
   Tradera IMPORT – ta emot ordrar som JSON
   ------------------------------------------------------- */
router.post('/tradera/import', async (req, res) => {
  try {
    const body = req.body || {};
    const emailQ = String(body.email || '').trim().toLowerCase();
    const orders = Array.isArray(body.orders) ? body.orders : [];

    if (!emailQ) {
      return res
        .status(400)
        .json({ ok: false, error: 'Saknar email i request body.' });
    }

    if (!orders.length) {
      return res.status(400).json({
        ok: false,
        error: 'Saknar orders i request body (orders måste vara en lista).',
      });
    }

    const result = await importTraderaOrdersForEmail(emailQ, orders);

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error('Tradera import error', err);
    return res.status(500).json({
      ok: false,
      error:
        err && err.message
          ? err.message
          : 'Kunde inte importera Tradera-ordrar.',
    });
  }
});

/* -------------------------------------------------------
   eBay – auth-skelett (koppla konto via OAuth)
   ------------------------------------------------------- */

/**
 * POST /integrations/ebay/connect
 * Input: { email }
 * Gör:
 *  - Slår upp kund via email
 *  - Bygger en eBay-OAuth-URL för den kunden
 * Output:
 *  - { ok: true, redirectUrl }
 * Frontend kan sedan göra: window.location = redirectUrl
 */
router.post('/ebay/connect', async (req, res) => {
  try {
    const body = req.body || {};
    const emailTrim = String(body.email || '').trim().toLowerCase();

    if (!emailTrim) {
      return res
        .status(400)
        .json({ ok: false, error: 'Saknar e-post i request body.' });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ subjectRef: emailTrim }, { email: emailTrim }],
      },
    });

    if (!customer) {
      return res
        .status(404)
        .json({ ok: false, error: 'Kund hittades inte.' });
    }

    const { redirectUrl } = buildEbayAuthUrlForCustomer(customer.id);

    return res.json({
      ok: true,
      redirectUrl,
    });
  } catch (err) {
    console.error('eBay connect error', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte skapa eBay-auth-URL.' });
  }
});

/**
 * GET /integrations/ebay/callback
 * Hit kommer eBay efter att användaren loggat in och godkänt vår app.
 * Query-parametrar: ?code=...&state=...
 *
 * Just nu:
 *  - Verifierar att code + state finns
 *  - Använder ebayService för att verifiera state och koppla till customerId
 *  - BYTER INTE code -> token ännu (det gör vi i nästa steg)
 */
router.get('/ebay/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();

    if (!code || !state) {
      return res
        .status(400)
        .json({ ok: false, error: 'Saknar code eller state i callback.' });
    }

    const result = await handleEbayCallback({ code, state });

    return res.json({
      ok: true,
      ...result,
      message:
        'eBay callback mottagen. Token-utbyte och lagring implementeras i nästa steg.',
    });
  } catch (err) {
    console.error('eBay callback error', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hantera eBay-callback.' });
  }
});

module.exports = router;
