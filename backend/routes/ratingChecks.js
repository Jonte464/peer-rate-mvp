// routes/ratingChecks.js
import express from 'express';
import prisma from '../prismaClient.js'; // justera import om du har annan sökväg
import { requireAuth } from '../middleware/authMiddleware.js'; // justera om din auth heter annat

const router = express.Router();

/**
 * GET /api/ratings/exists?dealId=...
 * Returnerar om inloggad användare redan har lämnat rating för dealId
 */
router.get('/ratings/exists', requireAuth, async (req, res) => {
  try {
    const dealId = String(req.query.dealId || '').trim();
    if (!dealId) {
      return res.status(400).json({ ok: false, error: 'Missing dealId' });
    }

    // requireAuth bör sätta req.user eller liknande.
    // Anpassa nedan rad efter din implementation:
    const customerId = req.user?.customerId || req.user?.id;
    if (!customerId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const exists = await prisma.rating.findFirst({
      where: { customerId, dealId },
      select: { id: true },
    });

    return res.json({ ok: true, exists: !!exists });
  } catch (err) {
    console.error('[ratings/exists] error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;