// backend/routes/ebayRoutes.js
// Endpoints för eBay-data (efter OAuth)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { fetchEbayOrders } = require('../services/ebayOrdersService');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/ebay/orders?email=...
 * Kräver att användaren redan gjort OAuth och att du har token sparad.
 *
 * OBS: Jag antar här att du sparar eBay-token någonstans i DB.
 * Om du ännu inte sparar token: säg till så kopplar vi det direkt i callbacken.
 */
router.get('/ebay/orders', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'Saknar email' });

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: email }, { email }] },
    });
    if (!customer) return res.status(404).json({ ok: false, error: 'Kund hittades inte' });

    // HÄR: byt detta till exakt där du sparar eBay-token i din databas
    // Jag gissar att du sparar det i externalProfile/rawJson eller liknande.
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

    const data = await fetchEbayOrders({ accessToken, limit: 50, offset: 0 });

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('GET /api/ebay/orders error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfel' });
  }
});

module.exports = router;
