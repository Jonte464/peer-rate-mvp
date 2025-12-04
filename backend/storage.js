// backend/storage.js — Prisma-baserad lagring + rapportstöd + kundregister
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Tradera-relaterade funktioner flyttade till egen modul
const {
  upsertTraderaProfile,
  saveTraderaOrders,
  getTraderaSummaryBySubjectRef,
} = require('./storage.tradera');

/** Hämta/Skapa kund på subjectRef (normaliserad, t.ex. e-post) */
async function getOrCreateCustomerBySubjectRef(subjectRef) {
  const existing = await prisma.customer.findUnique({
    where: { subjectRef },
    select: { id: true, subjectRef: true },
  });
  if (existing) return existing;

  return prisma.customer.create({
    data: { subjectRef },
    select: { id: true, subjectRef: true },
  });
}

/** Skapa rating och returnera ids */
async function createRating(item) {
  // item: { subjectRef, rating, comment, raterName, raterEmail?, proofRef, createdAt, ratingSource?/source? }
  const customer = await getOrCreateCustomerBySubjectRef(item.subjectRef);

  // Dubblettspärr 24h per raterName (om satt)
  if (item.raterName) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dup = await prisma.rating.findFirst({
      where: {
        customerId: customer.id,
        raterName: item.raterName,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (dup) {
      const err = new Error('duplicate_24h');
      err.code = 'DUP_24H';
      throw err;
    }
  }

  const rating = await prisma.rating.create({
    data: {
      customerId: customer.id,
      score: item.rating,
      text: item.comment || null,

      // Vem gav omdömet?
      raterName: item.raterName || null,
      raterEmail: item.raterEmail || null,

      // Verifierings-info
      proofRef: item.proofRef || null,

      // Källa (Blocket, Tradera, Tiptap, …)
      ratingSource: item.ratingSource || item.source || 'OTHER',

      ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
    },
    select: { id: true },
  });

  return { ok: true, customerId: customer.id, ratingId: rating.id };
}

/** Skapa en rapport (kopplad till kund och ev. rating/transaction) */
async function createReport(data) {
  // data kan innehålla:
  // reportedCustomerId (obligatorisk)
  // ratingId, transactionId (valfria)
  // reason
  // details / description
  // evidenceUrl / evidenceLink
  // occurredAt (datum/tid för händelsen)
  // amount / amountSek
  // currency
  // counterpartyLink
  // reporterConsent (checkbox)
  // verificationId

  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : null;

  // Belopp kan komma som number/string eller under nyckeln "amountSek"
  let amountValue = null;
  if (data.amount !== undefined && data.amount !== null && data.amount !== '') {
    amountValue = data.amount;
  } else if (
    data.amountSek !== undefined &&
    data.amountSek !== null &&
    data.amountSek !== ''
  ) {
    amountValue = data.amountSek;
  }

  await prisma.report.create({
    data: {
      reportedCustomerId: data.reportedCustomerId,
      ratingId: data.ratingId || null,
      transactionId: data.transactionId || null,

      reason: data.reason,
      details: data.details || data.description || null,

      evidenceUrl: data.evidenceUrl || data.evidenceLink || null,
      verificationId: data.verificationId || null,

      occurredAt,
      amount: amountValue,
      currency: data.currency || 'SEK',

      counterpartyLink: data.counterpartyLink || null,
      reporterConsent: data.reporterConsent === true,

      // status blir default (OPEN) enligt schema.prisma
    },
  });

  return { ok: true };
}

/** Lista ratings för subjectRef (senaste först) */
async function listRatingsBySubjectRef(subjectRef) {
  const customer = await prisma.customer.findUnique({
    where: { subjectRef },
    select: { id: true },
  });
  if (!customer) return [];

  const rows = await prisma.rating.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      score: true,
      text: true,
      raterName: true,
      raterEmail: true,
      proofRef: true,
      ratingSource: true,
      createdAt: true,
      customer: { select: { subjectRef: true } },
    },
  });

  return rows.map((r) => {
    const subject = r.customer?.subjectRef || subjectRef;
    const hasProof = !!(r.proofRef && r.proofRef.length > 0);

    // Maskad variant om vi vill dölja hela mejlen
    let raterMasked = null;
    if (r.raterName) {
      raterMasked = r.raterName;
    } else if (r.raterEmail) {
      const [local, domain] = r.raterEmail.split('@');
      if (local && domain) {
        const maskedLocal =
          local.length <= 2
            ? local[0] + '*'
            : local[0] +
              '*'.repeat(Math.max(1, local.length - 2)) +
              local.slice(-1);
        raterMasked = `${maskedLocal}@${domain}`;
      } else {
        raterMasked = r.raterEmail;
      }
    }

    return {
      id: r.id,
      subject,
      rating: r.score,
      comment: r.text || '',

      // Rådata – dessa använder vi i UI för "av <namn>"
      raterName: r.raterName || null,
      raterEmail: r.raterEmail || null,
      raterMasked,

      hasProof,
      proofHash: null,
      createdAt: r.createdAt.toISOString(),

      // Källa till betyget
      ratingSource: r.ratingSource || 'OTHER',
    };
  });
}

/** Snitt */
async function averageForSubjectRef(subjectRef) {
  const customer = await prisma.customer.findUnique({
    where: { subjectRef },
    select: { id: true },
  });
  if (!customer) return { count: 0, average: 0 };

  const agg = await prisma.rating.aggregate({
    where: { customerId: customer.id },
    _avg: { score: true },
    _count: { _all: true },
  });
  const avg = agg._avg.score ?? 0;
  const count = agg._count._all ?? 0;
  return { count, average: Number(avg.toFixed(2)) };
}

/** Senaste globalt */
async function listRecentRatings(limit = 20) {
  const rows = await prisma.rating.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { customer: { select: { subjectRef: true } } },
  });

  return rows.map((r) => {
    const subject = r.customer?.subjectRef || '(unknown)';
    const hasProof = !!(r.proofRef && r.proofRef.length > 0);

    let raterMasked = null;
    if (r.raterName) {
      raterMasked = r.raterName;
    } else if (r.raterEmail) {
      const [local, domain] = r.raterEmail.split('@');
      if (local && domain) {
        const maskedLocal =
          local.length <= 2
            ? local[0] + '*'
            : local[0] +
              '*'.repeat(Math.max(1, local.length - 2)) +
              local.slice(-1);
        raterMasked = `${maskedLocal}@${domain}`;
      } else {
        raterMasked = r.raterEmail;
      }
    }

    return {
      id: r.id,
      subject,
      rating: r.score,
      comment: r.text || '',

      raterName: r.raterName || null,
      raterEmail: r.raterEmail || null,
      raterMasked,

      hasProof,
      proofHash: null,
      createdAt: r.createdAt.toISOString(),

      ratingSource: r.ratingSource || 'OTHER',
    };
  });
}

/** Skapa kund i kundregistret */
async function createCustomer(data) {
  const created = await prisma.customer.create({
    data: {
      subjectRef: data.subjectRef,
      fullName: data.fullName || null,
      personalNumber: data.personalNumber || null,
      email: data.email || null,
      phone: data.phone || null,
      addressStreet: data.addressStreet || null,
      addressZip: data.addressZip || null,
      addressCity: data.addressCity || null,
      country: data.country || null,
      passwordHash: data.passwordHash || null,
      thirdPartyConsent: data.thirdPartyConsent === true,
    },
    select: {
      id: true,
      subjectRef: true,
      fullName: true,
      personalNumber: true,
      email: true,
      createdAt: true,
    },
  });
  return created;
}

/** Sök kunder (enkel textmatch) */
async function searchCustomers(q) {
  const rows = await prisma.customer.findMany({
    where: {
      OR: [
        { subjectRef: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { personalNumber: { contains: q } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      subjectRef: true,
      fullName: true,
      personalNumber: true,
      email: true,
      phone: true,
      addressStreet: true,
      addressZip: true,
      addressCity: true,
      country: true,
      createdAt: true,
      thirdPartyConsent: true,
    },
  });
  return rows;
}

/** Hämta kund för login via subjectRef (vi använder email=subjectRef) */
async function findCustomerBySubjectRef(subjectRef) {
  return prisma.customer.findUnique({
    where: { subjectRef },
    select: {
      id: true,
      subjectRef: true,
      fullName: true,
      email: true,
      passwordHash: true,
      personalNumber: true,
      createdAt: true,
      thirdPartyConsent: true,
      addressStreet: true,
      addressZip: true,
      addressCity: true,
      country: true,
    },
  });
}

/* ===================== ADMIN-FUNKTIONER ===================== */

async function adminGetCounts() {
  const [customers, ratings, reports] = await Promise.all([
    prisma.customer.count(),
    prisma.rating.count(),
    prisma.report.count(),
  ]);
  return { customers, ratings, reports };
}

async function adminListRecentReports(limit = 20) {
  const rows = await prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      reportedCustomer: { select: { subjectRef: true, fullName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),

    subjectRef: r.reportedCustomer?.subjectRef || null,
    fullName: r.reportedCustomer?.fullName || null,

    // Alla viktiga fält från rapporten:
    details: r.details || null,
    evidenceUrl: r.evidenceUrl || null,
    verificationId: r.verificationId || null,
    occurredAt: r.occurredAt ? r.occurredAt.toISOString() : null,
    amount: r.amount ? r.amount.toString() : null,
    currency: r.currency || 'SEK',
    counterpartyLink: r.counterpartyLink || null,
    reporterConsent: r.reporterConsent ?? null,
  }));
}

async function adminGetCustomerWithRatings(query) {
  const candidate = await prisma.customer.findFirst({
    where: {
      OR: [
        { email: query.toLowerCase() },
        { subjectRef: query.toLowerCase() },
        { personalNumber: query },
      ],
    },
    include: {
      ratings: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!candidate) {
    const list = await prisma.customer.findMany({
      where: {
        OR: [
          { subjectRef: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        ratings: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!list.length) return null;
    return list[0];
  }

  return candidate;
}

module.exports = {
  getOrCreateCustomerBySubjectRef,
  createRating,
  createReport,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,
  createCustomer,
  searchCustomers,
  findCustomerBySubjectRef,
  adminGetCounts,
  adminListRecentReports,
  adminGetCustomerWithRatings,

  // Tradera-relaterade hjälpfunktioner (nu i egen modul)
  upsertTraderaProfile,
  saveTraderaOrders,
  getTraderaSummaryBySubjectRef,
};
