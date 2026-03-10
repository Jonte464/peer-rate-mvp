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

function digitsOnly(v) {
  return normalizeText(v).replace(/\D/g, "");
}

function uniqueNonEmpty(arr) {
  return Array.from(new Set((arr || []).map((v) => normalizeText(v)).filter(Boolean)));
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

function extractItemId(body) {
  return (
    normalizeText(body?.deal?.itemId) ||
    normalizeText(body?.counterparty?.itemId) ||
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
 *
 * Robust matchning i flera steg:
 * 1) deal via platform + externalProofRef
 * 2) deal via platform + externalItemId
 * 3) rating.proofRef
 * 4) deal via pageUrl
 */
router.post("/ratings/check-deal-status", async (req, res) => {
  try {
    const platform = mapExternalPlatform(req.body?.source || req.body?.deal?.platform || "");
    const proofRef = extractProofRef(req.body);
    const itemId = extractItemId(req.body);
    const pageUrl = normalizeText(req.body?.pageUrl || req.body?.deal?.pageUrl || req.body?.counterparty?.pageUrl || "");
    const canonicalKey = buildCanonicalKey(platform, proofRef);

    if (!proofRef && !itemId && !pageUrl) {
      return res.status(400).json({
        ok: false,
        error: "Missing proofRef/itemId/pageUrl",
      });
    }

    let matchedBy = null;
    let alreadyRated = false;
    let matchedDealId = null;

    const proofCandidates = uniqueNonEmpty([
      proofRef,
      digitsOnly(proofRef),
      req.body?.deal?.orderId,
      digitsOnly(req.body?.deal?.orderId),
      req.body?.counterparty?.orderId,
      digitsOnly(req.body?.counterparty?.orderId),
    ]);

    const itemCandidates = uniqueNonEmpty([
      itemId,
      digitsOnly(itemId),
      req.body?.deal?.itemId,
      digitsOnly(req.body?.deal?.itemId),
      req.body?.counterparty?.itemId,
      digitsOnly(req.body?.counterparty?.itemId),
    ]);

    // -----------------------------
    // 1) Matcha deal via externalProofRef
    // -----------------------------
    if (!alreadyRated && proofCandidates.length) {
      const existingDeal = await prisma.deal.findFirst({
        where: {
          platform,
          OR: proofCandidates.map((candidate) => ({
            externalProofRef: {
              equals: candidate,
              mode: "insensitive",
            },
          })),
        },
        select: { id: true, externalProofRef: true, externalItemId: true },
      });

      if (existingDeal?.id) {
        matchedDealId = existingDeal.id;

        const ratingOnDeal = await prisma.rating.findFirst({
          where: { dealId: existingDeal.id },
          select: { id: true },
        });

        if (ratingOnDeal?.id) {
          alreadyRated = true;
          matchedBy = "deal.externalProofRef -> rating.dealId";
        }
      }
    }

    // -----------------------------
    // 2) Matcha deal via externalItemId
    // -----------------------------
    if (!alreadyRated && itemCandidates.length) {
      const existingDealByItem = await prisma.deal.findFirst({
        where: {
          platform,
          OR: itemCandidates.map((candidate) => ({
            externalItemId: {
              equals: candidate,
              mode: "insensitive",
            },
          })),
        },
        select: { id: true, externalProofRef: true, externalItemId: true },
      });

      if (existingDealByItem?.id) {
        matchedDealId = existingDealByItem.id;

        const ratingOnDeal = await prisma.rating.findFirst({
          where: { dealId: existingDealByItem.id },
          select: { id: true },
        });

        if (ratingOnDeal?.id) {
          alreadyRated = true;
          matchedBy = "deal.externalItemId -> rating.dealId";
        }
      }
    }

    // -----------------------------
    // 3) Fallback: rating.proofRef
    // -----------------------------
    if (!alreadyRated && proofCandidates.length) {
      const ratingByProofRef = await prisma.rating.findFirst({
        where: {
          OR: proofCandidates.map((candidate) => ({
            proofRef: {
              equals: candidate,
              mode: "insensitive",
            },
          })),
        },
        select: { id: true, proofRef: true, dealId: true },
      });

      if (ratingByProofRef?.id) {
        alreadyRated = true;
        matchedBy = "rating.proofRef";
        matchedDealId = ratingByProofRef.dealId || null;
      }
    }

    // -----------------------------
    // 4) Fallback: deal via pageUrl
    // -----------------------------
    if (!alreadyRated && pageUrl) {
      const existingDealByUrl = await prisma.deal.findFirst({
        where: {
          platform,
          externalPageUrl: {
            equals: pageUrl,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (existingDealByUrl?.id) {
        matchedDealId = existingDealByUrl.id;

        const ratingOnDeal = await prisma.rating.findFirst({
          where: { dealId: existingDealByUrl.id },
          select: { id: true },
        });

        if (ratingOnDeal?.id) {
          alreadyRated = true;
          matchedBy = "deal.externalPageUrl -> rating.dealId";
        }
      }
    }

    return res.json({
      ok: true,
      alreadyRated,
      canRate: !alreadyRated,
      platform,
      proofRef,
      itemId,
      pageUrl: pageUrl || null,
      canonicalKey,
      matchedBy,
      matchedDealId,
      debug: {
        proofCandidates,
        itemCandidates,
      },
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