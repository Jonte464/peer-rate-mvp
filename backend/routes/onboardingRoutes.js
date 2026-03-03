// backend/routes/onboardingRoutes.js
const express = require('express');

const router = express.Router();

/**
 * POST /api/onboarding/complete-profile
 * Body: { email }
 * Syfte: markera en kund som "profileComplete=true" när steg 2 är klart.
 *
 * OBS: Detta är en minimal additiv route.
 * Du kan senare lägga på auth / token-check om du vill.
 */
router.post('/onboarding/complete-profile', async (req, res) => {
  try {
    const prisma = req.prisma || global.prisma;
    if (!prisma) return res.status(500).json({ error: 'Prisma not available' });

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });

    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const updated = await prisma.customer.update({
      where: { email },
      data: { profileComplete: true },
      select: { id: true, email: true, profileComplete: true },
    });

    return res.json({ ok: true, customer: updated });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
});

module.exports = router;