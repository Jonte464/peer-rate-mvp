// backend/routes/ratingChecksRoutes.js
// CommonJS-router som matchar server.js (require) och ger ratings/exists-endpoint.

const express = require("express");
const router = express.Router();

// Anpassa dessa require-sökvägar om din struktur skiljer sig:
const prisma = require("../prismaClient"); // om du har prismaClient.js i backend/
const { requireAuth } = require("../middleware/authMiddleware"); // om du har middleware/authMiddleware.js

/**
 * GET /api/ratings/exists?dealId=...
 * Returnerar om inloggad användare redan har lämnat rating för dealId
 */
router.get("/ratings/exists", requireAuth, async (req, res) => {
  try {
    const dealId = String(req.query.dealId || "").trim();
    if (!dealId) {
      return res.status(400).json({ ok: false, error: "Missing dealId" });
    }

    const customerId = req.user?.customerId || req.user?.id;
    if (!customerId) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const exists = await prisma.rating.findFirst({
      where: { customerId, dealId },
      select: { id: true },
    });

    return res.json({ ok: true, exists: !!exists });
  } catch (err) {
    console.error("[ratings/exists] error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;