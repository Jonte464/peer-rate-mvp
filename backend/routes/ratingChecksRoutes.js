// backend/routes/ratingChecksRoutes.js
// CommonJS-router för deal/rating-checks.
// Behåller legacy-endpointen /ratings/exists
// och lägger till ny plattformsoberoende endpoint:
// POST /api/ratings/check-deal-status

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

function requireAuthCompat(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ ok: false, error: "Not authenticated" });
}

function normalizeText(v) {
  return String(v || "").trim();
}

function normalizeTextLower(v) {
  return normalizeText(v).toLowerCase();
}

function mapExternalPlatform(input) {
  const v = normalizeText(input).toUpperCase();

  if (v.includes("TRADERA")) return "TRADERA";
  if (v.includes("BLOCKET")) return "BLOCKET";
  if (v.includes("AIRBNB")) return "AIRBNB";
  if (v.includes("EBAY")) return "EBAY";
  if (v.includes("TIPTAP")) return "TIPTAP";
  if (v.includes("HYGGLO")) return "HYGGLO";
  if (v.includes("HUSKNUTEN")) return "HUSKNUTEN";
  if (v.includes("FACEBOOK")) return "FACEBOOK";

  return "OTHER";
}

function extractProofRef(body) {
  return (
    normalizeText(body?.proofRef) ||
    normalizeText(body?.deal?.orderId) ||
    normalizeText(body?.deal?.bookingId) ||
    normalizeText(body?.deal?.transactionId) ||
    normalizeText(body?.deal?.externalProofRef) ||
    normalizeText(body?.counterparty?.orderId) ||
    normalizeText(body?.pageUrl) ||
    ""
  );
}

function buildCanonicalKey(source, proofRef) {
  const s = normalizeTextLower(source);
  const p = normalizeTextLower(proofRef);
  if (!s || !p) return "";
  return `${s}|${p}`;
}

/**
 * Legacy:
 * GET /api/ratings/exists?dealId=...
 * Returnerar om inloggad användare redan lämnat rating för dealId
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
    console.error("[GET /ratings/exists] error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * Ny:
 * POST /api/ratings/check-deal-status
 *
 * Public check för extension + frontend.
 * Syfte:
 * - avgöra om en verifierad affär redan blivit betygsatt
 * - fungera plattformsoberoende
 *
 * In:
 * {
 *   source: "tradera",
 *   proofRef: "145376613",
 *   pageUrl: "...",
 *   deal: {...}
 * }
 *
 * Ut:
 * {
 *   ok: true,
 *   alreadyRated: true/false,
 *   canRate: true/false,
 *   platform: "TRADERA",
 *   proofRef: "...",
 *   canonicalKey: "tradera|145376613",
 *   matchedBy: "deal+rating" | "rating.proofRef" | null
 * }
 */
router.post("/ratings/check-deal-status", async (req, res) => {
  try {
    const platform = mapExternalPlatform(req.body?.source || req.body?.deal?.platform || "");
    const proofRef = extractProofRef(req.body);
    const canonicalKey = buildCanonicalKey(platform, proofRef);

    if (!proofRef) {
      return res.status(400).json({
        ok: false,
        error: "Missing proofRef",
      });
    }

    let matchedBy = null;
    let alreadyRated = false;

    // 1) Försök först hitta deal via platform + externalProofRef
    const existingDeal = await prisma.deal.findFirst({
      where: {
        platform,
        externalProofRef: {
          equals: proofRef,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingDeal?.id) {
      const ratingOnDeal = await prisma.rating.findFirst({
        where: { dealId: existingDeal.id },
        select: { id: true },
      });

      if (ratingOnDeal?.id) {
        alreadyRated = true;
        matchedBy = "deal+rating";
      }
    }

    // 2) Fallback: rating.proofRef
    if (!alreadyRated) {
      const ratingByProofRef = await prisma.rating.findFirst({
        where: {
          proofRef: {
            equals: proofRef,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (ratingByProofRef?.id) {
        alreadyRated = true;
        matchedBy = "rating.proofRef";
      }
    }

    return res.json({
      ok: true,
      alreadyRated,
      canRate: !alreadyRated,
      platform,
      proofRef,
      canonicalKey,
      matchedBy,
    });
  } catch (err) {
    console.error("[POST /ratings/check-deal-status] error:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

module.exports = router;