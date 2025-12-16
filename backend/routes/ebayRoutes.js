// backend/routes/ebayRoutes.js
// Endpoints för eBay-data (status + orders)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { fetchEbayOrders } = require('../services/ebayOrdersService');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/ebay/status?email=...
 * Returnerar om eBay är kopplat för användaren
 */
router.get('/ebay/status', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Saknar email' });
    }

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: email }, { email }] },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    const profile = await prisma.externalProfile.findFirst({
      where: {
        customerId: customer.id,
        platform: 'EBAY',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      return res.json({
        ok: true,
        connected: false,
      });
    }

    return res.json({
      ok: true,
      connected: true,
      externalProfileId: profile.id,
      lastSyncedAt: profile.lastSyncedAt,
    });
  } catch (err) {
    console.error('GET /api/ebay/status error', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Serverfel',
    });
  }
});

/**
 * GET /api/ebay/orders?email=...
 * Hämtar eBay-ordrar (Sell Fulfillment)
 */
router.get('/ebay/orders', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Saknar email' });
    }

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: email }, { email }] },
    });
    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    const ebayProfile = await prisma.externalProfile.findFirst({
      where: { customerId: customer.id, platform: 'EBAY' },
      orderBy: { createdAt: 'desc' },
    });

    if (!ebayProfile) {
      return res.status(400).json({
        ok: false,
        error: 'Ingen eBay-profil kopplad ännu.',
      });
    }

    const raw = ebayProfile.rawJson || {};
    const accessToken = raw.access_token || raw.accessToken || null;

    if (!accessToken) {
      return res.status(400).json({
        ok: false,
        error: 'Ingen access token hittades för eBay-profilen.',
      });
    }

    const data = await fetchEbayOrders({
      accessToken,
      limit: 50,
      offset: 0,
    });

    // uppdatera "senast synkad"
    await prisma.externalProfile.update({
      where: { id: ebayProfile.id },
      data: { lastSyncedAt: new Date() },
    });

    return res.json({
      ok: true,
      externalProfileId: ebayProfile.id,
      data,
    });
  } catch (err) {
    console.error('GET /api/ebay/orders error', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Serverfel',
    });
  }
});

module.exports = router;
