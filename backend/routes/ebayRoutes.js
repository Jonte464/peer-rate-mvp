// backend/routes/ebayRoutes.js
// Endpoints för eBay-data (efter OAuth)

const express = require('express');
const { fetchEbayOrders } = require('../services/ebayOrdersService');
const { getValidEbayAccessTokenByEmail } = require('../services/ebayTokenService');

const router = express.Router();

/**
 * GET /api/ebay/orders?email=...
 * - Läser token från DB (ExternalProfile EBAY)
 * - Refresh:ar automatiskt om access token gått ut
 * - Hämtar orders från eBay
 */
router.get('/ebay/orders', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'Saknar email' });

    const { externalProfileId, accessToken } = await getValidEbayAccessTokenByEmail(email);

    const data = await fetchEbayOrders({ accessToken, limit: 50, offset: 0 });

    return res.json({
      ok: true,
      externalProfileId,
      data,
    });
  } catch (err) {
    console.error('GET /api/ebay/orders error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Serverfel' });
  }
});

module.exports = router;
