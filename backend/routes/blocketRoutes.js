// backend/routes/blocketRoutes.js
// Hanterar Blocket-koppling

const express = require('express');
const { connectBlocketProfile } = require('../services/blocketService');

const router = express.Router();

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

module.exports = router;
