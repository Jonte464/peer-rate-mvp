// backend/storage.ratings.js — Prisma-lagring för betyg (ratings)

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

function isEmail(s) {
  const v = String(s || '').trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Skapa rating och returnera ids */
async function createRating(item) {
  // item: { subjectRef, rating, comment, raterName, raterEmail, proofRef, createdAt, ratingSource?/source? }
  const customer = await getOrCreateCustomerBySubjectRef(item.subjectRef);

  const proofRef = (item.proofRef || '').toString().trim() || null;

  // Normalisera raterEmail om det ser ut som email
  const raterEmail =
    item.raterEmail && isEmail(item.raterEmail)
      ? String(item.raterEmail).trim().toLowerCase()
      : null;

  const raterName =
    item.raterName && !raterEmail
      ? String(item.raterName).trim()
      : (item.raterName ? String(item.raterName).trim() : null);

  // ✅ 1) Hård regel: samma rater + samma proofRef + samma mottagare -> stoppa
  // (extra check innan DB-unique, så vi kan ge bättre error-kod)
  if (proofRef && raterEmail) {
    const existingSameDeal = await prisma.rating.findFirst({
      where: {
        customerId: customer.id,
        proofRef,
        raterEmail,
      },
      select: { id: true },
    });

    if (existingSameDeal) {
      const err = new Error('duplicate_deal');
      err.code = 'DUP_DEAL';
      throw err;
    }
  }

  // ✅ 2) Behåll din gamla 24h-spärr (bakåtkomp / extra skydd)
  // Dubblettspärr 24h per raterName (om satt)
  if (raterName) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dup = await prisma.rating.findFirst({
      where: {
        customerId: customer.id,
        raterName,
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
      raterName: raterName || null,
      raterEmail: raterEmail || null,

      // Verifierings-info
      proofRef: proofRef || null,

      // Källa (Blocket, Tradera, Tiptap, …)
      ratingSource: item.ratingSource || item.source || 'OTHER',

      ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
    },
    select: { id: true },
  });

  return { ok: true, customerId: customer.id, ratingId: rating.id };
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

/** Snitt för en subjectRef */
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

/** Senaste ratings globalt */
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

module.exports = {
  getOrCreateCustomerBySubjectRef,
  createRating,
  listRatingsBySubjectRef,
  averageForSubjectRef,
  listRecentRatings,
};
