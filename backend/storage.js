// backend/storage.js — Prisma-baserad lagring + rapportstöd + kundregister
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Rating-funktioner i egen modul
const {
  getOrCreateCustomerBySubjectRef,
  createRating,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,
} = require('./storage.ratings');

// Tradera integration removed

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
  // Kund- och rapportfunktioner
  createReport,
  createCustomer,
  searchCustomers,
  findCustomerBySubjectRef,
  adminGetCounts,
  adminListRecentReports,
  adminGetCustomerWithRatings,

  // Rating-funktioner (från storage.ratings.js)
  getOrCreateCustomerBySubjectRef,
  createRating,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,

  // Tradera integration removed
};
