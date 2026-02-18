// backend/storage.tradera.js — Prisma-lagring för Tradera-integration

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Upsert för Tradera-profil kopplad till kund.
 * Vi använder ExternalProfile med platform = "TRADERA".
 *
 * payload: {
 *   externalUserId,
 *   username,
 *   email,
 *   authToken,
 *   authTokenExpiresAt, // Date eller ISO-sträng
 *   profileJson         // valfri JSON med extra profilinfo
 * }
 */
async function upsertTraderaProfile(customerId, payload) {
  const existing = await prisma.externalProfile.findFirst({
    where: {
      customerId,
      platform: 'TRADERA',
    },
  });

  const data = {
    platform: 'TRADERA',
    customerId,
    username: payload.username || payload.email || 'Tradera-konto',
    externalUserId: payload.externalUserId || null,
    authToken: payload.authToken || null,
    authTokenExpiresAt: payload.authTokenExpiresAt
      ? new Date(payload.authTokenExpiresAt)
      : null,
    profileJson: payload.profileJson || null,
    status: 'ACTIVE',
    lastSyncedAt: payload.lastSyncedAt
      ? new Date(payload.lastSyncedAt)
      : new Date(),
  };

  if (existing) {
    return prisma.externalProfile.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.externalProfile.create({ data });
}

/**
 * Spara (eller uppdatera) Tradera-ordrar för en given ExternalProfile (TRADERA).
 * orders är en array av:
 * {
 *   traderaOrderId,
 *   traderaItemId?,
 *   title,
 *   amount?,
 *   currency?,
 *   role?,              // "BUYER" | "SELLER"
 *   counterpartyAlias?,
 *   counterpartyEmail?,
 *   completedAt?,       // Date eller ISO-sträng
 *   rawJson?            // valfri JSON från Tradera
 * }
 */
async function saveTraderaOrders(externalProfileId, orders) {
  if (!Array.isArray(orders) || orders.length === 0)
    return { ok: true, count: 0 };

  let savedCount = 0;

  for (const o of orders) {
    if (!o.traderaOrderId) continue;

    // Kontrollera om ordern redan finns (vi vill undvika dubbletter)
    const existing = await prisma.traderaOrder.findFirst({
      where: {
        externalProfileId,
        traderaOrderId: o.traderaOrderId,
      },
    });

    const data = {
      externalProfileId,
      traderaOrderId: o.traderaOrderId,
      traderaItemId: o.traderaItemId || null,
      title: o.title || '(okänd artikel)',
      amount:
        typeof o.amount === 'number' || typeof o.amount === 'string'
          ? o.amount
          : null,
      currency: o.currency || 'SEK',
      role: o.role === 'BUYER' ? 'BUYER' : 'SELLER',
      counterpartyAlias: o.counterpartyAlias || null,
      counterpartyEmail: o.counterpartyEmail || null,
      completedAt: o.completedAt ? new Date(o.completedAt) : null,
      rawJson: o.rawJson || null,
    };

    if (existing) {
      await prisma.traderaOrder.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.traderaOrder.create({ data });
    }

    savedCount += 1;
  }

  return { ok: true, count: savedCount };
}

/**
 * Hämta Tradera-data för en kund via subjectRef (e-post).
 * Detta ska användas av "Min profil" för att rendera Tradera-blocket.
 * Vi begränsar oss till de senaste 12 månaderna.
 *
 * ✅ NYTT: hasRating = true/false per order genom match mot Rating:
 *          ratingSource=TRADERA och proofRef=traderaOrderId
 */
async function getTraderaSummaryBySubjectRef(subjectRef, opts = {}) {
  const customer = await prisma.customer.findUnique({
    where: { subjectRef },
    select: { id: true },
  });
  if (!customer) {
    return {
      hasTradera: false,
      profile: null,
      orders: [],
      summary: { totalOrders: 0, ratedOrders: 0, unratedOrders: 0 },
    };
  }

  const externalProfile = await prisma.externalProfile.findFirst({
    where: {
      customerId: customer.id,
      platform: 'TRADERA',
    },
  });

  if (!externalProfile) {
    return {
      hasTradera: false,
      profile: null,
      orders: [],
      summary: { totalOrders: 0, ratedOrders: 0, unratedOrders: 0 },
    };
  }

  const take = typeof opts.limit === 'number' ? opts.limit : 50;

  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

  const orders = await prisma.traderaOrder.findMany({
    where: {
      externalProfileId: externalProfile.id,
      // Bara senaste 12 månaderna
      completedAt: { gte: twelveMonthsAgo },
    },
    orderBy: { completedAt: 'desc' },
    take,
  });

  // ✅ Batch-check mot Rating-tabellen (ingen N+1)
  const orderIds = orders.map((o) => o.traderaOrderId).filter(Boolean);
  let ratedSet = new Set();

  if (orderIds.length) {
    const rated = await prisma.rating.findMany({
      where: {
        ratingSource: 'TRADERA',
        proofRef: { in: orderIds },
      },
      select: { proofRef: true },
    });

    ratedSet = new Set(
      rated
        .map((r) => r.proofRef)
        .filter(Boolean)
    );
  }

  const profileJson = externalProfile.profileJson || {};
  const profile = {
    username: externalProfile.username || null,
    email: profileJson.email || null,
    externalUserId: externalProfile.externalUserId || null,
    // Om vi i framtiden har "accountCreatedAt" i profileJson kan vi använda det
    accountCreatedAt: profileJson.accountCreatedAt || null,
    feedbackScore: profileJson.feedbackScore || null,
    feedbackCountPositive: profileJson.feedbackCountPositive || null,
    feedbackCountNegative: profileJson.feedbackCountNegative || null,
    lastSyncedAt: externalProfile.lastSyncedAt
      ? externalProfile.lastSyncedAt.toISOString()
      : null,
  };

  const mappedOrders = orders.map((o) => {
    const hasRating = ratedSet.has(o.traderaOrderId);
    return {
      id: o.id,
      traderaOrderId: o.traderaOrderId,
      traderaItemId: o.traderaItemId,
      title: o.title,
      amount: o.amount ? o.amount.toString() : null,
      currency: o.currency || 'SEK',
      role: o.role, // "BUYER" | "SELLER"
      counterpartyAlias: o.counterpartyAlias || null,
      counterpartyEmail: o.counterpartyEmail || null,
      completedAt: o.completedAt ? o.completedAt.toISOString() : null,
      hasRating,
    };
  });

  const totalOrders = mappedOrders.length;
  const ratedOrders = mappedOrders.filter((o) => o.hasRating).length;
  const unratedOrders = totalOrders - ratedOrders;

  const summary = {
    totalOrders,
    ratedOrders,
    unratedOrders,
  };

  return {
    hasTradera: true,
    profile,
    orders: mappedOrders,
    summary,
  };
}

module.exports = {
  upsertTraderaProfile,
  saveTraderaOrders,
  getTraderaSummaryBySubjectRef,
};
