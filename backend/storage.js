// backend/storage.js — Prisma-baserad lagring + rapportstöd
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/** Hämta/Skapa kund på subjectRef (normaliserad) */
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
      reason: data.reason, // måste vara en giltig enum i schema (FRAUD/IMPERSONATION/...)
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
    },
  });

  return rows.map((r) => ({
    id: r.id,
    subject: subjectRef,
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

module.exports = {
  getOrCreateCustomerBySubjectRef,
  createRating,
  createReport,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,
};
