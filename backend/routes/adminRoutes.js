// backend/routes/adminRoutes.js

const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');

const {
  adminGetCounts,
  adminListRecentReports,
  adminGetCustomerWithRatings,
  listRecentRatings,
  averageForSubjectRef,
} = require('../storage');

const prisma = new PrismaClient();
const router = express.Router();

// Läs adminlösenord från .env
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
  // Frontend sparar detta lösenord och skickar i x-admin-key-header.
  res.json({ ok: true });
});

// Alla routes nedan kräver admin
router.use(requireAdmin);

/** GET /api/admin/summary – admin-översikt: totalsiffror */
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
  const limit = Number(req.query.limit || 20);
  try {
    const list = await listRecentRatings(limit);
    res.json({ ok: true, ratings: list });
  } catch (e) {
    console.error('[GET /api/admin/ratings/recent] error:', e);
    res.status(500).json({
      ok: false,
      error: 'Kunde inte hämta senaste ratings (admin).',
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
