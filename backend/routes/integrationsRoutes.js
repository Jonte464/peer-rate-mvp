// backend/routes/integrationsRoutes.js
// Hanterar externa integrationer: extern data, Blocket, Tradera, m.m.

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const { connectBlocketProfile } = require('../services/blocketService');
// Kryptering för Tradera-lösenord
const { encryptSecret } = require('../services/secretService');
// Tradera-service: sync + import
const {
  syncTraderaForEmail,
  importTraderaOrdersForEmail,
} = require('../services/traderaService');

// Endast det vi behöver härifrån storage
const { findCustomerBySubjectRef } = require('../storage');

// Hjälpfunktioner
const {
  extractAddressPartsFromCustomer,
  buildExternalDataResponse,
} = require('../helpers');

// PAP API service (adressverifiering)
const { lookupAddressWithPapApi } = require('../services/papApiService');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/customers/external-data
 * Hämtar ENDAST extern data. Ingen fallback till profilen.
 *
 * OBS: Denna router monteras under /api i server.js,
 * så här använder vi bara "/customers/external-data".
 */
router.get('/customers/external-data', async (req, res) => {
  try {
    const emailOrSubject = String(req.query.email || '').trim().toLowerCase();
    if (!emailOrSubject) {
      return res.status(400).json({ ok: false, error: 'Saknar email' });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ subjectRef: emailOrSubject }, { email: emailOrSubject }],
      },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    const { street, number, zipcode, city } =
      extractAddressPartsFromCustomer(customer);

    let validatedAddress = null;
    let addressStatus = 'NO_EXTERNAL_DATA';
    let vehiclesCount = null;
    let propertiesCount = null;

    if (street || zipcode || city) {
      try {
        const externalAddress = await lookupAddressWithPapApi({
          street,
          number,
          zipcode,
          city,
        });

        if (externalAddress && typeof externalAddress === 'object') {
          const addrObj =
            externalAddress.normalizedAddress ||
            externalAddress.address ||
            externalAddress;

          const extStreet =
            addrObj.street ||
            addrObj.addressStreet ||
            addrObj.gatuadress ||
            null;
          const extZip =
            addrObj.zipcode ||
            addrObj.postalCode ||
            addrObj.postnr ||
            null;
          const extCity =
            addrObj.city ||
            addrObj.postort ||
            addrObj.addressCity ||
            null;

          const parts = [extStreet, extZip, extCity].filter(Boolean);
          if (parts.length) {
            validatedAddress = parts.join(', ');
          }

          vehiclesCount =
            externalAddress.vehiclesCount ??
            externalAddress.vehicleCount ??
            externalAddress.vehicles ??
            null;

          propertiesCount =
            externalAddress.propertiesCount ??
            externalAddress.propertyCount ??
            externalAddress.properties ??
            null;

          if (validatedAddress) {
            addressStatus = externalAddress.status
              ? String(externalAddress.status).toUpperCase()
              : externalAddress.matchStatus
              ? String(externalAddress.matchStatus).toUpperCase()
              : 'VERIFIED';
          } else {
            addressStatus = 'NO_ADDRESS_IN_RESPONSE';
          }
        }
      } catch (err) {
        console.error('PAP API lookup failed', err);
        addressStatus = 'LOOKUP_FAILED';
      }
    } else {
      addressStatus = 'NO_ADDRESS_INPUT';
    }

    const now = new Date().toISOString();

    return res.json({
      ok: true,
      vehiclesCount,
      propertiesCount,
      lastUpdated: now,
      validatedAddress,
      addressStatus,
    });
  } catch (err) {
    console.error('external-data error', err);
    return res.status(500).json({ ok: false, error: 'Internt serverfel' });
  }
});

/* -------------------------------------------------------
   Blocket-koppling (extern)
   ------------------------------------------------------- */
router.post('/external/blocket/connect', async (req, res) => {
  try {
    const { customerId, username, password } = req.body;

    if (!customerId || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const profile = await connectBlocketProfile(customerId, username, password);

    res.json({
      success: true,
      profile,
    });
  } catch (err) {
    console.error('Blocket connect error:', err);
    res.status(500).json({ error: 'Failed to connect Blocket profile' });
  }
});

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
   Hämta extern data (DEMO) baserat på profil
   ------------------------------------------------------- */
router.get('/profile/external-demo', async (req, res) => {
  try {
    const subjectQ = String(req.query.subject || '').trim().toLowerCase();

    let customer = null;
    if (req.user && req.user.id) {
      customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
      });
    } else if (subjectQ) {
      customer = await findCustomerBySubjectRef(subjectQ);
    } else {
      return res.status(401).json({
        ok: false,
        error:
          'Ej inloggad. Ange subject som queryparameter för publik lookup.',
      });
    }

    if (!customer)
      return res.status(404).json({ ok: false, error: 'Kund saknas' });

    const { street, number, zipcode, city } =
      extractAddressPartsFromCustomer(customer);

    let externalAddress = null;
    try {
      if (street || zipcode || city) {
        externalAddress = await lookupAddressWithPapApi({
          street,
          number,
          zipcode,
          city,
        });
      }
    } catch (err) {
      console.error('PAP API lookup failed', err);
      externalAddress = null;
    }

    const payload = buildExternalDataResponse(customer, externalAddress);
    return res.json(payload);
  } catch (err) {
    console.error('External demo error', err);
    return res.status(500).json({
      ok: false,
      error: 'Serverfel vid extern hämtning',
    });
  }
});

module.exports = router;
