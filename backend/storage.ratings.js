// backend/storage/storage.ratings.js — Prisma-lagring för betyg (ratings)

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/** Hämta/Skapa kund på subjectRef (normaliserad, t.ex. e-post) */
async function getOrCreateCustomerBySubjectRef(subjectRef) {
  const existing = await prisma.customer.findUnique({
    where: { subjectRef },
    select: { id: true, subjectRef: true, email: true },
  });
  if (existing) return existing;

  return prisma.customer.create({
    data: { subjectRef },
    select: { id: true, subjectRef: true, email: true },
  });
}

function isEmail(s) {
  const v = String(s || '').trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function mapRatingSourceToPlatform(ratingSource) {
  const rs = String(ratingSource || '').toUpperCase();
  if (rs === 'TRADERA') return 'TRADERA';
  if (rs === 'BLOCKET') return 'BLOCKET';
  if (rs === 'EBAY') return 'EBAY';
  return null;
}

function parseDealCompletedAt(deal) {
  const iso = deal?.dateISO || deal?.date || null;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmount(deal) {
  // deal.amount kan vara number/string, deal.amountSek är integer
  const raw = deal?.amount ?? null;
  if (raw !== null && raw !== undefined && raw !== '') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
    if (!Number.isNaN(n)) return n;
  }
  const sek = deal?.amountSek;
  if (typeof sek === 'number' && !Number.isNaN(sek)) return sek;
  return null;
}

/** Upsert Deal baserat på plattform + proofRef(orderId) */
async function upsertDealForVerifiedRating({ customerId, ratingSource, proofRef, deal }) {
  const platform = mapRatingSourceToPlatform(ratingSource) || (deal?.platform ? String(deal.platform).toUpperCase() : null);
  const externalProofRef = (proofRef || deal?.orderId || '').toString().trim() || null;

  // Krav för “Verified Deals”: vi behöver plattform + proofRef
  if (!platform || !externalProofRef) return null;

  const data = {
    // Nuvarande Deal-modell kräver sellerId -> vi sätter den till “den som blir betygsatt” (customerId)
    sellerId: customerId,

    platform,
    source: platform === 'TRADERA' ? 'TRADERA_EXTENSION' : 'PARTNER_API',
    status: 'PENDING_RATING',

    externalProofRef,
    externalItemId: deal?.itemId ? String(deal.itemId) : null,
    externalPageUrl: deal?.pageUrl ? String(deal.pageUrl) : null,
    title: deal?.title ? String(deal.title) : null,

    amount: (() => {
      const n = parseAmount(deal);
      return n === null ? null : n;
    })(),
    currency: deal?.currency ? String(deal.currency) : (platform === 'TRADERA' ? 'SEK' : 'SEK'),

    completedAt: parseDealCompletedAt(deal),
  };

  // Prisma upsert kräver unique constraint: @@unique([platform, externalProofRef])
  const dealRow = await prisma.deal.upsert({
    where: {
      platform_externalProofRef: {
        platform,
        externalProofRef,
      },
    },
    create: data,
    update: {
      // uppdatera bara om ny data kommer in
      externalItemId: data.externalItemId || undefined,
      externalPageUrl: data.externalPageUrl || undefined,
      title: data.title || undefined,
      amount: data.amount === null ? undefined : data.amount,
      currency: data.currency || undefined,
      completedAt: data.completedAt || undefined,
      updatedAt: new Date(),
    },
    select: { id: true, status: true },
  });

  return dealRow;
}

/** Skapa rating och returnera ids */
async function createRating(item) {
  // item: { subjectRef, rating, comment, raterName, raterEmail, proofRef, createdAt, ratingSource, deal? }
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

  const ratingSource = item.ratingSource || item.source || 'OTHER';

  // ✅ 0) Upsert Deal (om verifierad deal finns)
  // Vi gör detta tidigt så vi kan koppla rating.dealId.
  const dealRow = await upsertDealForVerifiedRating({
    customerId: customer.id,
    ratingSource,
    proofRef,
    deal: item.deal || null,
  });
  const dealId = dealRow?.id || null;

  // ✅ 1) Hård regel: stoppa dubbelrating för samma affär per rater
  // (extra check innan DB-unique, för bättre felkod)
  if (proofRef) {
    const where = {
      customerId: customer.id,
      proofRef,
      ratingSource,
    };

    // matcha antingen raterEmail eller raterName (beroende på vad vi har)
    if (raterEmail) where.raterEmail = raterEmail;
    if (!raterEmail && raterName) where.raterName = raterName;

    // om inget rater alls: vi kan inte göra "per rater" check här (DB-unique fångar vissa fall via raterName)
    if (raterEmail || raterName) {
      const existingSameDeal = await prisma.rating.findFirst({
        where,
        select: { id: true },
      });

      if (existingSameDeal) {
        const err = new Error('duplicate_deal');
        err.code = 'DUP_DEAL';
        throw err;
      }
    }
  }

  // ✅ 2) Behåll din gamla 24h-spärr (bakåtkomp / extra skydd)
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

  // ✅ 3) Skapa rating (nu med dealId)
  const rating = await prisma.rating.create({
    data: {
      customerId: customer.id,
      dealId: dealId || null,

      score: item.rating,
      text: item.comment || null,

      raterName: raterName || null,
      raterEmail: raterEmail || null,

      proofRef: proofRef || null,
      ratingSource,

      ...(item.createdAt ? { createdAt: new Date(item.createdAt) } : {}),
    },
    select: { id: true },
  });

  // ✅ 4) Markera deal som RATED (om vi har en deal kopplad)
  if (dealId) {
    try {
      await prisma.deal.update({
        where: { id: dealId },
        data: { status: 'RATED' },
      });
    } catch (_) {
      // inte kritiskt om detta failar
    }
  }

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
      dealId: true,
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
      dealId: r.dealId || null,
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
      dealId: r.dealId || null,
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
