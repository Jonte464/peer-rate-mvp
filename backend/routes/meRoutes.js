// backend/routes/meRoutes.js
const express = require("express");
const router = express.Router();

/**
 * MVP "who am I" endpoints:
 * - GET /api/customers/me
 * - GET /api/profile/me  (alias)
 * - GET /api/auth/me     (alias)
 *
 * Identifiering (MVP):
 * 1) Header: x-user-email
 * 2) Query:  ?email=
 *
 * OBS: Detta är en kompatibilitetslösning för att få profile.html att fungera.
 * Byt senare till riktig auth (session/JWT) och ta bort query fallback.
 */

function getEmailFromReq(req) {
  const h = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (h) return h;

  const q = String(req.query.email || "").trim().toLowerCase();
  if (q) return q;

  return "";
}

async function fetchCustomerByEmail(req, res) {
  try {
    const prisma = req.prisma || global.prisma;
    if (!prisma) return res.status(500).json({ ok: false, error: "Prisma not available" });

    const email = getEmailFromReq(req);
    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "Missing identity. Provide x-user-email header (or ?email= for MVP).",
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        personalNumber: true,
        phone: true,
        addressStreet: true,
        addressZip: true,
        addressCity: true,
        country: true,
        profileComplete: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) return res.status(404).json({ ok: false, error: "Customer not found" });

    return res.json({ ok: true, customer });
  } catch (err) {
    console.error("meRoutes error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}

// customer "me"
router.get("/customers/me", fetchCustomerByEmail);

// profile "me" (alias)
router.get("/profile/me", fetchCustomerByEmail);

// auth "me" (alias) – frontend verkar kalla denna också
router.get("/auth/me", fetchCustomerByEmail);

module.exports = router;