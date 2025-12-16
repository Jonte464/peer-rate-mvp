// backend/routes/ebayRoutes.js
// Endpoints för eBay-data (efter OAuth)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { fetchEbayOrders } = require('../services/ebayOrdersService');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * Försöker plocka ut access token från olika ställen
 * (vi stödjer flera varianter eftersom vi kan ha sparat på olika sätt).
 */
function extractAccessToken(profile) {
  if (!profile) return null;

  // 1) Om vi sparar access token i authToken (rekommenderat enkelt fält)
  if (profile.authToken && String(profile.authToken).trim()) {
    return String(profile.authToken).trim();
  }

  // 2) Om vi sparar token i profileJson
  const pj = profile.profileJson || {};
  const candidates = [
    pj.access_token,
    pj.accessToken,
    pj.token?.access_token,
    pj.token?.accessToken,
    pj.ebay?.access_token,
    pj.ebay?.accessToken,
  ].filter(Boolean);

  if (candidates.length) return String(candidates[0]).trim();

  // 3) Bakåtkomp: om du tidigare råkat använda rawJson i någon version
  const rj = profile.rawJson || {};
  const candidates2 = [
    rj.access_token,
    rj.accessToken,
    rj.token?.access_token,
    rj.token?.accessToken,
  ].filter(Boolean);

  if (candidates2.length) return String(candidates2[0]).trim();

  return null;
}

/**
 * GET /api/ebay/orders?email=...
 * Hämtar ordrar från eBay (Fulfillment/Sell API) med sparad access token.
 */
router.get('/ebay/orders', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'Saknar email' });

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: email }, { email }] },
    });
    if (!customer) return res.status(404).json({ ok: false, error: 'Kund hittades inte' });

    // Hämta eBay-profilen (senaste)
    const ebayProfile = await prisma.externalProfile.findFirst({
      where: { customerId: customer.id, platform: 'EBAY' },
      orderBy: { createdAt: 'desc' },
    });

    if (!ebayProfile) {
      return res.status(400).json({
        ok: false,
        error: 'Ingen eBay-profil hittades för kunden ännu. Koppla eBay först.',
      });
    }

    const accessToken = extractAccessToken(ebayProfile);

    if (!accessToken) {
      return res.status(400).json({
        ok: false,
        error:
          'Ingen access token hittades för eBay-profilen. (Den kan vara sparad på annat fält än vi letar i.)',
      });
    }

    const data = await fetchEbayOrders({ accessToken, limit: 50, offset: 0 });

    return res.json({ ok: true, externalProfileId: ebayProfile.id, data });
  } catch (err) {
    console.error('GET /api/ebay/orders error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfel' });
  }
});

module.exports = router;
