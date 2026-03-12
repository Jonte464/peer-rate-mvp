// backend/routes/adminRoutes.js

const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');

const {
  adminGetCounts,
  adminListRecentReports,
  adminGetCustomerWithRatings,
  averageForSubjectRef,
} = require('../storage');

const prisma = global.prisma || new PrismaClient();
const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

/** Admin-login-schema */
const adminLoginSchema = Joi.object({
  password: Joi.string().min(6).max(200).required(),
});

/** Middleware: kräver admin */
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({
      ok: false,
      error: 'Admin-läge ej konfigurerat (saknar ADMIN_PASSWORD).',
    });
  }
  const key = req.headers['x-admin-key'] || '';
  if (key && key === ADMIN_PASSWORD) return next();
  return res.status(401).json({ ok: false, error: 'Ej behörig (admin).' });
}

function safeDateIso(value) {
  try {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function formatRecentRatingRow(row) {
  const customerEmail = row?.customer?.email || null;
  const customerSubjectRef = row?.customer?.subjectRef || null;

  const ratedUser =
    customerEmail ||
    customerSubjectRef ||
    null;

  const raterDisplay =
    row?.raterName ||
    row?.raterEmail ||
    '–';

  return {
    id: row.id,
    createdAt: safeDateIso(row.createdAt),
    rating: row.score,
    score: row.score,
    subject: ratedUser,
    ratedUser,
    comment: row.text || '',
    text: row.text || '',
    raterName: row.raterName || null,
    raterEmail: row.raterEmail || null,
    raterDisplay,
    dealId: row.dealId || null,
    ratingSource: row.ratingSource || null,
  };
}

function formatAmountDisplay(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return null;
  return `${String(amount)} ${String(currency || 'SEK')}`.trim();
}

/* -------------------------------------------------------
   POST /api/admin/login
   ------------------------------------------------------- */
router.post('/login', (req, res) => {
  const { error, value } = adminLoginSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ogiltigt admin-lösenord.' });
  }
  if (!ADMIN_PASSWORD) {
    return res
      .status(500)
      .json({ ok: false, error: 'ADMIN_PASSWORD saknas i servern.' });
  }
  if (value.password !== ADMIN_PASSWORD) {
    return res
      .status(401)
      .json({ ok: false, error: 'Fel admin-lösenord.' });
  }
  res.json({ ok: true });
});

router.use(requireAdmin);

/** GET /api/admin/summary – admin-översikt */
router.get('/summary', async (_req, res) => {
  try {
    const counts = await adminGetCounts();
    res.json({ ok: true, counts });
  } catch (e) {
    console.error('[GET /api/admin/summary] error:', e);
    res.status(500).json({
      ok: false,
      error: 'Kunde inte hämta admin-sammanfattning.',
    });
  }
});

/** GET /api/admin/ratings/recent – senaste ratings (admin) */
router.get('/ratings/recent', async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 20)));

  try {
    const rows = await prisma.rating.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        score: true,
        text: true,
        raterName: true,
        raterEmail: true,
        ratingSource: true,
        dealId: true,
        createdAt: true,
        customer: {
          select: {
            email: true,
            subjectRef: true,
            fullName: true,
          },
        },
      },
    });

    const ratings = rows.map(formatRecentRatingRow);
    res.json({ ok: true, ratings });
  } catch (e) {
    console.error('[GET /api/admin/ratings/recent] error:', e);
    res.status(500).json({
      ok: false,
      error: 'Kunde inte hämta senaste ratings (admin).',
    });
  }
});

/** GET /api/admin/alerts/suspicious-deals – deals med fler än 2 omdömen */
router.get('/alerts/suspicious-deals', async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

  try {
    const deals = await prisma.deal.findMany({
      where: {
        externalProofRef: {
          not: null,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 500,
      select: {
        id: true,
        platform: true,
        externalProofRef: true,
        externalItemId: true,
        externalPageUrl: true,
        title: true,
        amount: true,
        currency: true,
        updatedAt: true,
        _count: {
          select: {
            ratings: true,
          },
        },
        ratings: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            score: true,
            text: true,
            raterName: true,
            raterEmail: true,
            createdAt: true,
            customer: {
              select: {
                email: true,
                subjectRef: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    const suspicious = deals
      .filter((deal) => Number(deal?._count?.ratings || 0) > 2)
      .slice(0, limit)
      .map((deal) => ({
        dealId: deal.id,
        platform: deal.platform,
        externalProofRef: deal.externalProofRef || null,
        externalItemId: deal.externalItemId || null,
        externalPageUrl: deal.externalPageUrl || null,
        title: deal.title || null,
        amountDisplay: formatAmountDisplay(deal.amount, deal.currency),
        ratingCount: Number(deal?._count?.ratings || 0),
        updatedAt: safeDateIso(deal.updatedAt),
        ratings: (deal.ratings || []).map((r) => ({
          id: r.id,
          createdAt: safeDateIso(r.createdAt),
          score: r.score,
          rating: r.score,
          text: r.text || '',
          comment: r.text || '',
          ratedUser:
            r?.customer?.email ||
            r?.customer?.subjectRef ||
            null,
          raterName: r.raterName || null,
          raterEmail: r.raterEmail || null,
          raterDisplay: r.raterName || r.raterEmail || '–',
        })),
      }));

    return res.json({
      ok: true,
      count: suspicious.length,
      alerts: suspicious,
    });
  } catch (e) {
    console.error('[GET /api/admin/alerts/suspicious-deals] error:', e);
    return res.status(500).json({
      ok: false,
      error: 'Kunde inte hämta suspicious deal alerts.',
    });
  }
});

/** DELETE /api/admin/ratings/:id – radera rating (admin) */
router.delete('/ratings/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({
      ok: false,
      error: 'Ogiltigt rating-ID.',
    });
  }

  try {
    const rating = await prisma.rating.findUnique({
      where: { id },
      select: {
        id: true,
        dealId: true,
      },
    });

    if (!rating) {
      return res.status(404).json({
        ok: false,
        error: 'Omdömet hittades inte.',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.report.deleteMany({
        where: {
          ratingId: id,
        },
      });

      await tx.rating.delete({
        where: { id },
      });

      if (rating.dealId) {
        const remaining = await tx.rating.count({
          where: { dealId: rating.dealId },
        });

        if (remaining === 0) {
          await tx.deal.update({
            where: { id: rating.dealId },
            data: { status: 'PENDING_RATING' },
          });
        }
      }
    });

    return res.json({
      ok: true,
      deletedRatingId: id,
    });
  } catch (e) {
    console.error('[DELETE /api/admin/ratings/:id] error:', e);
    return res.status(500).json({
      ok: false,
      error: 'Kunde inte radera omdömet.',
    });
  }
});

/** GET /api/admin/reports/recent – senaste rapporter (admin) */
router.get('/reports/recent', async (req, res) => {
  const limit = Number(req.query.limit || 20);
  try {
    const list = await adminListRecentReports(limit);
    res.json({ ok: true, reports: list });
  } catch (e) {
    console.error('[GET /api/admin/reports/recent] error:', e);
    res.status(500).json({
      ok: false,
      error: 'Kunde inte hämta senaste rapporter (admin).',
    });
  }
});

/** GET /api/admin/customers – lista kunder (admin) */
router.get('/customers', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(
      1000,
      Math.max(1, Number(req.query.limit || 50))
    );
    const skip = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          subjectRef: true,
          fullName: true,
          email: true,
          personalNumber: true,
          createdAt: true,
        },
      }),
      prisma.customer.count(),
    ]);

    const customers = rows.map((r) => ({
      id: r.id,
      subjectRef: r.subjectRef,
      fullName: r.fullName || null,
      email: r.email || null,
      personalNumber: r.personalNumber || null,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    }));

    res.json({
      ok: true,
      count: customers.length,
      total,
      page,
      pageSize,
      customers,
    });
  } catch (e) {
    console.error('[GET /api/admin/customers] error:', e);
    res.status(500).json({ ok: false, error: 'Kunde inte hämta kunder' });
  }
});

/** DELETE /api/admin/customers/:id – radera kund + relaterade data (admin) */
router.delete('/customers/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ogiltigt kund-ID.' });
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return res
        .status(404)
        .json({ ok: false, error: 'Kunden hittades inte.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.rating.deleteMany({ where: { customerId: id } });
      await tx.report.deleteMany({ where: { reportedCustomerId: id } });
      await tx.transaction.deleteMany({ where: { customerId: id } });
      await tx.score.deleteMany({ where: { customerId: id } });

      await tx.deal.deleteMany({
        where: {
          OR: [{ sellerId: id }, { buyerId: id }],
        },
      });

      await tx.traderaOrder.deleteMany({
        where: {
          externalProfile: { customerId: id },
        },
      });
      await tx.listing.deleteMany({
        where: {
          externalProfile: { customerId: id },
        },
      });
      await tx.externalProfile.deleteMany({ where: { customerId: id } });

      await tx.customer.delete({ where: { id } });
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/admin/customers/:id] error:', e);
    res
      .status(500)
      .json({ ok: false, error: 'Kunde inte radera kund.' });
  }
});

/** GET /api/admin/customer – sök kund + ratings (admin) */
router.get('/customer', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q)
    return res
      .status(400)
      .json({ ok: false, error: 'Ange q i querystring.' });

  try {
    const customer = await adminGetCustomerWithRatings(q);
    if (!customer) {
      return res.json({ ok: true, customer: null });
    }
    const subjectRef =
      customer.subjectRef || (customer.email || '').toLowerCase();
    let avgData = { count: 0, average: 0 };
    if (subjectRef) {
      avgData = await averageForSubjectRef(subjectRef);
    }

    res.json({
      ok: true,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        subjectRef: customer.subjectRef,
        email: customer.email,
        personalNumber: customer.personalNumber,
        createdAt: customer.createdAt,
        ratings: customer.ratings.map((r) => ({
          id: r.id,
          score: r.score,
          text: r.text,
          raterName: r.raterName,
          raterEmail: r.raterEmail,
          createdAt: r.createdAt,
        })),
        average: avgData.average,
        count: avgData.count,
      },
    });
  } catch (e) {
    console.error('[GET /api/admin/customer] error:', e);
    res
      .status(500)
      .json({ ok: false, error: 'Kunde inte hämta kund (admin).' });
  }
});

module.exports = router;