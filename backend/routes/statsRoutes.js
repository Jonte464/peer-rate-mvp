// backend/routes/statsRoutes.js
// Publik KPI/statistik för landningssidan

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = global.prisma || new PrismaClient();
const router = express.Router();

function asInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET /api/stats/kpis
 *
 * Definitioner:
 * - registeredUsers      = riktiga registrerade konton (Customer med passwordHash)
 * - verifiedTransactions = Deal-poster i databasen
 * - ratings              = Rating-poster i databasen
 */
router.get("/stats/kpis", async (_req, res) => {
  try {
    const [registeredUsersCount, verifiedTransactionsCount, ratingsCount] = await Promise.all([
      prisma.customer.count({
        where: {
          passwordHash: {
            not: null,
          },
        },
      }),
      prisma.deal.count(),
      prisma.rating.count(),
    ]);

    return res.json({
      ok: true,
      kpis: {
        registeredUsers: asInt(registeredUsersCount),
        verifiedTransactions: asInt(verifiedTransactionsCount),
        ratings: asInt(ratingsCount),
      },
      definitions: {
        registeredUsers: "Customers with passwordHash (real registered accounts only)",
        verifiedTransactions: "Deals in database",
        ratings: "Ratings in database",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[GET /api/stats/kpis] error:", e && e.stack ? e.stack : e);
    return res.status(500).json({
      ok: false,
      error: "Kunde inte hämta KPI-statistik",
    });
  }
});

module.exports = router;