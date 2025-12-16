// backend/routes/integrationsRoutes.js
// Hanterar integrationer: Tradera (koppling, summary, mock, sync, import) + eBay (OAuth)

const express = require('express');
const { PrismaClient } = require('@prisma/client');

// Kryptering (vi använder samma som för Tradera-lösenord)
const { encryptSecret } = require('../services/secretService');

// Tradera-service: sync + import
const {
  syncTraderaForEmail,
  importTraderaOrdersForEmail,
} = require('../services/traderaService');

// eBay-service: auth-URL + callback-hantering
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
      return res.status(404).json({ ok: false, error: 'Kund hittades inte.' });
    }

    const encryptedPassword = passwordRaw ? encryptSecret(passwordRaw) : null;

    let profile = await prisma.externalProfile.findFirst({
      where: { customerId: customer.id, platform: 'TRADERA' },
    });

    const dataUpdate = { username: usernameTrim, status: 'ACTIVE' };
    if (encryptedPassword) dataUpdate.encryptedPassword = encryptedPassword;

    if (profile) {
      profile = await prisma.externalProfile.update({
        where: { id: profile.id },
        data: dataUpdate,
      });
    } else {
      profile = await prisma.externalProfile.create({
        data: { customerId: customer.id, platform: 'TRADERA', ...dataUpdate },
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
   Tradera-summary
   ------------------------------------------------------- */
router.get('/tradera/summary', async (req, res) => {
  try {
    const emailQ = String(req.query.email || '').trim().toLowerCase();
    const limitRaw = Number(req.query.limit || 50);
    const limit = Math.max(1, Math.min(200, Number.isNaN(limitRaw) ? 50 : limitRaw));

    if (!emailQ) {
      return res.status(400).json({ ok: false, error: 'Saknar email' });
    }

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: emailQ }, { email: emailQ }] },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    const profile = await prisma.externalProfile.findFirst({
      where: { customerId: customer.id, platform: 'TRADERA' },
    });

    if (!profile) {
      return res.json({
        ok: true,
        hasTradera: false,
        profile: null,
        orders: [],
        summary: { totalOrders: 0, ratedOrders: 0, unratedOrders: 0 },
      });
    }

    const ordersRaw = await prisma.traderaOrder.findMany({
      where: { externalProfileId: profile.id },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    const traderaIds = ordersRaw.map((o) => o.traderaOrderId).filter((id) => !!id);

    let ratingMap = new Map();
    if (traderaIds.length > 0) {
      const ratings = await prisma.rating.findMany({
        where: { proofRef: { in: traderaIds } },
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
      summary: { totalOrders, ratedOrders, unratedOrders },
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
   Tradera MOCK
   ------------------------------------------------------- */
router.post('/tradera/mock-orders', async (req, res) => {
  try {
    const emailQ = String(req.body.email || '').trim().toLowerCase();

    if (!emailQ) {
      return res.status(400).json({ ok: false, error: 'Saknar email i request body.' });
    }

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: emailQ }, { email: emailQ }] },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    const profile = await prisma.externalProfile.findFirst({
      where: { customerId: customer.id, platform: 'TRADERA' },
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

    await prisma.traderaOrder.deleteMany({ where: { externalProfileId: profile.id } });

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

    return res.json({ ok: true, createdCount: created.count || 0 });
  } catch (err) {
    console.error('Tradera mock-orders error', err);
    return res.status(500).json({ ok: false, error: 'Kunde inte skapa mock-Traderaordrar.' });
  }
});

/* -------------------------------------------------------
   Tradera SYNC-NOW
   ------------------------------------------------------- */
router.post('/tradera/sync-now', async (req, res) => {
  try {
    const emailQ = String(req.body.email || '').trim().toLowerCase();
    if (!emailQ) {
      return res.status(400).json({ ok: false, error: 'Saknar email i request body.' });
    }

    const result = await syncTraderaForEmail(emailQ);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Tradera sync-now error', err);
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : 'Kunde inte synka Tradera-data.',
    });
  }
});

/* -------------------------------------------------------
   Tradera IMPORT
   ------------------------------------------------------- */
router.post('/tradera/import', async (req, res) => {
  try {
    const body = req.body || {};
    const emailQ = String(body.email || '').trim().toLowerCase();
    const orders = Array.isArray(body.orders) ? body.orders : [];

    if (!emailQ) {
      return res.status(400).json({ ok: false, error: 'Saknar email i request body.' });
    }
    if (!orders.length) {
      return res.status(400).json({
        ok: false,
        error: 'Saknar orders i request body (orders måste vara en lista).',
      });
    }

    const result = await importTraderaOrdersForEmail(emailQ, orders);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Tradera import error', err);
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : 'Kunde inte importera Tradera-ordrar.',
    });
  }
});

/* -------------------------------------------------------
   eBay – OAuth (koppla konto via OAuth)
   Alternativ A: Spara token i DB (ExternalProfile.authToken + profileJson)
   ------------------------------------------------------- */

async function ebayConnectHandler(req, res) {
  try {
    const body = req.body || {};
    const emailTrim = String(body.email || '').trim().toLowerCase();

    if (!emailTrim) {
      return res
        .status(400)
        .json({ ok: false, error: 'Saknar e-post i request body.' });
    }

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: emailTrim }, { email: emailTrim }] },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte.' });
    }

    const { redirectUrl } = buildEbayAuthUrlForCustomer(customer.id);
    return res.json({ ok: true, redirectUrl });
  } catch (err) {
    console.error('eBay connect error', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte skapa eBay-auth-URL.' });
  }
}

async function ebayCallbackHandler(req, res) {
  try {
    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();

    if (!code || !state) {
      return res
        .status(400)
        .json({ ok: false, error: 'Saknar code eller state i callback.' });
    }

    // 1) Byt code -> tokens
    const result = await handleEbayCallback({ code, state });

    const customerId = result.customerId;
    const accessToken = result.accessToken;
    const refreshToken = result.refreshToken;

    if (!customerId) {
      return res.status(400).json({ ok: false, error: 'Saknar customerId i state.' });
    }
    if (!accessToken) {
      return res.status(500).json({ ok: false, error: 'Saknar accessToken från eBay.' });
    }

    // 2) Spara i DB på ställen som /api/ebay/orders faktiskt kan läsa
    const now = new Date();
    const expiresInSec = Number(result.expiresIn || 0);
    const refreshExpiresInSec = Number(result.refreshTokenExpiresIn || 0);

    const authTokenExpiresAt =
      expiresInSec > 0 ? new Date(Date.now() + expiresInSec * 1000) : null;

    // Vi sparar refresh token krypterat (bra praxis)
    const refreshTokenEncrypted = refreshToken ? encryptSecret(refreshToken) : null;

    // Hämta / skapa ExternalProfile för EBAY
    let profile = await prisma.externalProfile.findFirst({
      where: { customerId, platform: 'EBAY' },
      orderBy: { createdAt: 'desc' },
    });

    const dataUpdate = {
      // username krävs i din modell – vi sätter en enkel placeholder nu.
      // (Sen kan vi byta till riktigt eBay-user senare.)
      username: profile?.username || 'ebay',
      status: 'ACTIVE',

      // ✅ Här lägger vi access token där ebayRoutes letar först:
      authToken: accessToken,
      authTokenExpiresAt,

      // ✅ Här sparar vi extra info (utan att exponera raw tokens okrypterat)
      profileJson: {
        provider: 'ebay',
        tokenType: result.tokenType || null,
        scopes: result.scopes || null,
        obtainedAt: now.toISOString(),
        expiresIn: expiresInSec || null,
        refreshTokenExpiresIn: refreshExpiresInSec || null,
        refreshTokenEncrypted: refreshTokenEncrypted || null,
      },

      lastSyncedAt: now,
    };

    if (profile) {
      profile = await prisma.externalProfile.update({
        where: { id: profile.id },
        data: dataUpdate,
      });
    } else {
      profile = await prisma.externalProfile.create({
        data: {
          customerId,
          platform: 'EBAY',
          ...dataUpdate,
        },
      });
    }

    // 3) Redirect tillbaka till profilen istället för att visa JSON-sidan (mycket bättre UX)
    // Om du vill se JSON istället, byt till: return res.json({ ok:true, ... });
    return res.redirect('/profile.html?ebay=connected');
  } catch (err) {
    console.error('eBay callback error', err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || 'Kunde inte hantera eBay-callback.' });
  }
}

// Routes (vi behåller både nya och “alias” så inget gammalt går sönder)
router.post('/ebay/connect', ebayConnectHandler);
router.post('/integrations/ebay/connect', ebayConnectHandler);

router.get('/ebay/callback', ebayCallbackHandler);
router.get('/integrations/ebay/callback', ebayCallbackHandler);
