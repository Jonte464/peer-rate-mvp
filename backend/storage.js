// backend/storage.js — Prisma-baserad lagring + rapportstöd + kundregister
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  // item: { subjectRef, rating, comment, raterName, proofRef, createdAt }
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
      raterName: item.raterName || null,
      proofRef: item.proofRef || null,
      ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
    },
    select: { id: true },
  });

  return { ok: true, customerId: customer.id, ratingId: rating.id };
}

/** Skapa en rapport (kopplad till kund och ev. rating/transaction) */
async function createReport(data) {
  // data: { reportedCustomerId, ratingId?, transactionId?, reason, details?, evidenceUrl? }
  await prisma.report.create({
    data: {
      reportedCustomerId: data.reportedCustomerId,
      ratingId: data.ratingId || null,
      transactionId: data.transactionId || null,
      reason: data.reason,
      details: data.details || null,
      evidenceUrl: data.evidenceUrl || null,
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
      proofRef: true,
      createdAt: true,
      customer: { select: { subjectRef: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    subject: r.customer?.subjectRef || subjectRef,
    rating: r.score,
    comment: r.text || '',
    raterMasked: r.raterName || null,
    hasProof: !!(r.proofRef && r.proofRef.length > 0),
    proofHash: null,
    createdAt: r.createdAt.toISOString(),
  }));
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

  return rows.map((r) => ({
    id: r.id,
    subject: r.customer?.subjectRef || '(unknown)',
    rating: r.score,
    comment: r.text || '',
    raterMasked: r.raterName || null,
    hasProof: !!(r.proofRef && r.proofRef.length > 0),
    proofHash: null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Skapa kund i kundregistret */
async function createCustomer(data) {
  const created = await prisma.customer.create({
    data: {
      subjectRef: data.subjectRef, // vi sätter detta = email (lowercase)
      fullName: data.fullName || null,
      personalNumber: data.personalNumber || null,
      email: data.email || null,
      phone: data.phone || null,
      addressStreet: data.addressStreet || null,
      addressZip: data.addressZip || null,
      addressCity: data.addressCity || null,
      country: data.country || null,
      passwordHash: data.passwordHash || null,
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
    },
  });
}

/* ===================== ADMIN-FUNKTIONER ===================== */

/** Antal kunder, ratings, rapporter (admin-översikt) */
async function adminGetCounts() {
  const [customers, ratings, reports] = await Promise.all([
    prisma.customer.count(),
    prisma.rating.count(),
    prisma.report.count(),
  ]);
  return { customers, ratings, reports };
}

/** Senaste rapporter (admin-vy) */
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
    amount: r.amount ? r.amount.toString() : null,
    currency: r.currency || 'SEK',
  }));
}

/** Hämta en kund + dennes ratings (admin-sök) */
async function adminGetCustomerWithRatings(query) {
  // Försök först hitta på exakt email/subjectRef
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
    // fallback: enkel contains-sök
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
};
