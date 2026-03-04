// backend/routes/ratingChecksRoutes.js
// CommonJS-router som matchar server.js (require)
// och använder PrismaClient direkt (ingen beroende på ../prismaClient).

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Minimal auth-guard:
 * - Om du har riktig requireAuth i ditt projekt kan du byta till den senare.
 * - Just nu kräver vi bara att req.user finns, annars 401.
 *
 * OBS: Detta funkar endast om din befintliga auth faktiskt sätter req.user
 * (vilket den troligen gör).
 */
function requireAuthCompat(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ ok: false, error: "Not authenticated" });
}

/**
 * GET /api/ratings/exists?dealId=...
 * Returnerar om inloggad användare redan har lämnat rating för dealId
 */
router.get("/ratings/exists", requireAuthCompat, async (req, res) => {
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