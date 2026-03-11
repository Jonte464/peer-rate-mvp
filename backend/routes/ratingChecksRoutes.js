// backend/routes/ratingChecksRoutes.js
// CommonJS-router för deal/rating-checks.
// Behåller legacy-endpointen /ratings/exists
// och lägger till ny plattformsoberoende endpoint:
// POST /api/ratings/check-deal-status
//
// NYTT:
// - Extension-kanalen för TRADERA kräver marketplace identity match
// - Backend jämför aktivt marketplace-konto från sidan mot sparat ExternalProfile
// - Om identiteten inte matchar blockeras rating-popup

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = global.prisma || new PrismaClient();

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

function normalizeEmail(v) {
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

function extractPeerRateIdentity(req) {
  const headerEmail = normalizeEmail(req.headers["x-user-email"]);
  const bodyEmail =
    normalizeEmail(req.body?.peerRateIdentity?.email) ||
    normalizeEmail(req.body?.peerRateIdentity?.subjectRef) ||
    normalizeEmail(req.body?.peerRateEmail) ||
    "";

  const email = headerEmail || bodyEmail || "";

  return {
    email,
    id: normalizeText(req.body?.peerRateIdentity?.id || ""),
    subjectRef: normalizeEmail(req.body?.peerRateIdentity?.subjectRef || ""),
    fullName: normalizeText(req.body?.peerRateIdentity?.fullName || ""),
  };
}

function extractActiveMarketplaceIdentity(body) {
  const raw = body?.activeMarketplaceIdentity || {};
  const platform = mapExternalPlatform(raw.platform || body?.source || body?.deal?.platform || "");

  return {
    platform,
    username: normalizeText(raw.username || raw.alias || ""),
    email: normalizeEmail(raw.email || ""),
    name: normalizeText(raw.name || ""),
    confidence: normalizeText(raw.confidence || ""),
  };
}

function buildComparableIdentitySet(values) {
  const set = new Set();

  for (const v of values || []) {
    const text = normalizeTextLower(v);
    if (text) set.add(text);
  }

  return set;
}

async function findCustomerByIdentityEmail(email) {
  if (!email) return null;

  return prisma.customer.findFirst({
    where: {
      OR: [
        { email },
        { subjectRef: email },
      ],
    },
    select: {
      id: true,
      email: true,
      subjectRef: true,
      fullName: true,
    },
  });
}

async function findLinkedExternalProfile(customerId, platform) {
  if (!customerId || !platform || platform === "OTHER") return null;

  return prisma.externalProfile.findFirst({
    where: {
      customerId,
      platform,
    },
    select: {
      id: true,
      platform: true,
      username: true,
      email: true,
      externalUserId: true,
      status: true,
      updatedAt: true,
    },
  });
}

function evaluateIdentityMatch(linkedProfile, activeIdentity) {
  const linkedStatus = normalizeText(linkedProfile?.status || "").toUpperCase();
  const linkedUsername = normalizeText(linkedProfile?.username || "");
  const linkedEmail = normalizeEmail(linkedProfile?.email || "");
  const linkedExternalUserId = normalizeText(linkedProfile?.externalUserId || "");

  if (!linkedProfile) {
    return {
      ok: false,
      identityMatch: false,
      reason: "missing_linked_marketplace_profile",
      matchedOn: null,
    };
  }

  if (linkedStatus !== "ACTIVE") {
    return {
      ok: false,
      identityMatch: false,
      reason: "linked_marketplace_profile_not_active",
      matchedOn: null,
    };
  }

  if (!linkedUsername && !linkedEmail && !linkedExternalUserId) {
    return {
      ok: false,
      identityMatch: false,
      reason: "linked_marketplace_profile_missing_identity_values",
      matchedOn: null,
    };
  }

  const activeUsername = normalizeText(activeIdentity?.username || "");
  const activeEmail = normalizeEmail(activeIdentity?.email || "");

  if (!activeUsername && !activeEmail) {
    return {
      ok: false,
      identityMatch: false,
      reason: "missing_active_marketplace_identity",
      matchedOn: null,
    };
  }

  const linkedComparable = buildComparableIdentitySet([
    linkedUsername,
    linkedEmail,
    linkedExternalUserId,
  ]);

  const activeComparable = buildComparableIdentitySet([
    activeUsername,
    activeEmail,
  ]);

  for (const candidate of activeComparable) {
    if (linkedComparable.has(candidate)) {
      let matchedOn = "identity";
      if (candidate === normalizeTextLower(linkedUsername)) matchedOn = "username";
      else if (candidate === normalizeTextLower(linkedEmail)) matchedOn = "email";
      else if (candidate === normalizeTextLower(linkedExternalUserId)) matchedOn = "externalUserId";

      return {
        ok: true,
        identityMatch: true,
        reason: null,
        matchedOn,
      };
    }
  }

  return {
    ok: false,
    identityMatch: false,
    reason: "active_marketplace_identity_mismatch",
    matchedOn: null,
  };
}

async function evaluateMarketplaceIdentityGate(req, platform) {
  const peerRateIdentity = extractPeerRateIdentity(req);
  const activeMarketplaceIdentity = extractActiveMarketplaceIdentity(req.body);

  if (!peerRateIdentity.email) {
    return {
      ok: false,
      identityMatch: false,
      reason: "missing_peerrate_identity",
      matchedOn: null,
      linkedProfileFound: false,
      linkedProfileStatus: null,
      peerRateCustomerId: null,
      peerRateIdentity,
      activeMarketplaceIdentity,
    };
  }

  const customer = await findCustomerByIdentityEmail(peerRateIdentity.email);

  if (!customer?.id) {
    return {
      ok: false,
      identityMatch: false,
      reason: "peerrate_customer_not_found",
      matchedOn: null,
      linkedProfileFound: false,
      linkedProfileStatus: null,
      peerRateCustomerId: null,
      peerRateIdentity,
      activeMarketplaceIdentity,
    };
  }

  const linkedProfile = await findLinkedExternalProfile(customer.id, platform);
  const identityResult = evaluateIdentityMatch(linkedProfile, activeMarketplaceIdentity);

  return {
    ok: identityResult.ok,
    identityMatch: identityResult.identityMatch,
    reason: identityResult.reason,
    matchedOn: identityResult.matchedOn,
    linkedProfileFound: !!linkedProfile,
    linkedProfileStatus: linkedProfile?.status || null,
    peerRateCustomerId: customer.id,
    peerRateIdentity,
    activeMarketplaceIdentity,
  };
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
 *
 * NYTT:
 * - För TRADERA + extension-kanal krävs marketplace identity match
 */
router.post("/ratings/check-deal-status", async (req, res) => {
  try {
    const platform = mapExternalPlatform(req.body?.source || req.body?.deal?.platform || "");
    const proofRef = extractProofRef(req.body);
    const itemId = extractItemId(req.body);
    const pageUrl = normalizeText(req.body?.pageUrl || req.body?.deal?.pageUrl || req.body?.counterparty?.pageUrl || "");
    const canonicalKey = buildCanonicalKey(platform, proofRef);
    const channel = normalizeTextLower(req.body?.channel || "");
    const identityRequired = channel === "extension" && platform === "TRADERA";

    if (!proofRef && !itemId && !pageUrl) {
      return res.status(400).json({
        ok: false,
        error: "Missing proofRef/itemId/pageUrl",
      });
    }

    let identityGate = {
      ok: true,
      identityMatch: null,
      reason: null,
      matchedOn: null,
      linkedProfileFound: false,
      linkedProfileStatus: null,
      peerRateCustomerId: null,
      peerRateIdentity: extractPeerRateIdentity(req),
      activeMarketplaceIdentity: extractActiveMarketplaceIdentity(req.body),
    };

    if (identityRequired) {
      identityGate = await evaluateMarketplaceIdentityGate(req, platform);

      if (!identityGate.ok) {
        return res.json({
          ok: true,
          alreadyRated: false,
          canRate: false,
          platform,
          proofRef,
          itemId,
          pageUrl: pageUrl || null,
          canonicalKey,
          matchedBy: null,
          matchedDealId: null,
          identityRequired: true,
          identityMatch: false,
          identityReason: identityGate.reason,
          identityMatchedOn: identityGate.matchedOn,
          linkedMarketplaceFound: identityGate.linkedProfileFound,
          linkedMarketplaceStatus: identityGate.linkedProfileStatus,
          debug: {
            channel,
            identityRequired,
            peerRateIdentityEmail: identityGate.peerRateIdentity?.email || null,
            activeMarketplaceUsername: identityGate.activeMarketplaceIdentity?.username || null,
            activeMarketplaceEmail: identityGate.activeMarketplaceIdentity?.email || null,
          },
        });
      }
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
      canRate: identityRequired
        ? identityGate.identityMatch === true && !alreadyRated
        : !alreadyRated,
      platform,
      proofRef,
      itemId,
      pageUrl: pageUrl || null,
      canonicalKey,
      matchedBy,
      matchedDealId,
      identityRequired,
      identityMatch: identityRequired ? identityGate.identityMatch === true : null,
      identityReason: identityRequired ? identityGate.reason : null,
      identityMatchedOn: identityRequired ? identityGate.matchedOn : null,
      linkedMarketplaceFound: identityRequired ? identityGate.linkedProfileFound : null,
      linkedMarketplaceStatus: identityRequired ? identityGate.linkedProfileStatus : null,
      debug: {
        channel,
        proofCandidates,
        itemCandidates,
        peerRateIdentityEmail: identityGate.peerRateIdentity?.email || null,
        activeMarketplaceUsername: identityGate.activeMarketplaceIdentity?.username || null,
        activeMarketplaceEmail: identityGate.activeMarketplaceIdentity?.email || null,
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