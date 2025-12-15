// backend/routes/ebayRoutes.js
// Endpoints för eBay-data (efter OAuth)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { fetchEbayOrders } = require('../services/ebayOrdersService');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/ebay/orders?email=...&mode=BUY|SELL
 *
 * Kräver att användaren redan gjort OAuth och att token är sparad i DB.
 * Vi letar efter ExternalProfile(platform='EBAY') och tar access token från rawJson.
 */
router.get('/ebay/orders', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const mode = String(req.query.mode || 'BUY').trim().toUpperCase();

    if (!email) return res.status(400).json({ ok: false, error: 'Saknar email' });
    if (mode !== 'BUY' && mode !== 'SELL') {
      return res.status(400).json({ ok: false, error: 'mode måste vara BUY eller SELL' });
    }

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: email }, { email }] },
    });
    if (!customer) return res.status(404).json({ ok: false, error: 'Kund hittades inte' });

    const ebayProfile = await prisma.externalProfile.findFirst({
      where: { customerId: customer.id, platform: 'EBAY' },
      orderBy: { createdAt: 'desc' },
    });

    if (!ebayProfile) {
      return res.status(400).json({ ok: false, error: 'Ingen eBay-profil/token hittades för kunden ännu.' });
    }

    const raw = ebayProfile.rawJson || {};
    const accessToken = raw.access_token || raw.accessToken || null;

    if (!accessToken) {
      return res.status(400).json({ ok: false, error: 'Hittar ingen access token i DB (rawJson) för eBay-profilen.' });
    }

    const data = await fetchEbayOrders({ accessToken, mode, limit: 50, offset: 0 });

    return res.json({ ok: true, externalProfileId: ebayProfile.id, mode, data });
  } catch (err) {
    console.error('GET /api/ebay/orders error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfel' });
  }
});

module.exports = router;
