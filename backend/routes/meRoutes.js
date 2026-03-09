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

function getPrisma() {
  return global.prisma || null;
}

function getEmailFromReq(req) {
  const h = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (h) return h;

  const q = String(req.query.email || "").trim().toLowerCase();
  if (q) return q;

  return "";
}

function buildCustomerResponse(customer, fallbackEmail = "") {
  if (!customer) return null;

  const firstName = customer.firstName || null;
  const lastName = customer.lastName || null;
  const computedFullName =
    customer.fullName ||
    `${firstName || ""} ${lastName || ""}`.trim() ||
    null;

  return {
    id: customer.id,
    email: customer.email || fallbackEmail || null,
    subjectRef: customer.subjectRef || customer.email || fallbackEmail || null,
    fullName: computedFullName,
    firstName,
    lastName,
    personalNumber: customer.personalNumber || null,
    phone: customer.phone || null,
    addressStreet: customer.addressStreet || null,
    addressZip: customer.addressZip || null,
    addressCity: customer.addressCity || null,
    country: customer.country || null,
    profileComplete: Boolean(customer.profileComplete),
    createdAt: customer.createdAt || null,
    updatedAt: customer.updatedAt || null,
  };
}

async function fetchCustomerByEmail(req, res) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return res.status(500).json({
        ok: false,
        error: "Prisma not available",
      });
    }

    const email = getEmailFromReq(req);

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "Missing identity. Provide x-user-email header (or ?email= for MVP).",
      });
    }

    // Viktigt:
    // Använd findFirst istället för findUnique för att undvika runtime-500
    // om email inte är definierat som unique i Prisma-schemat.
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email },
          { subjectRef: email },
        ],
      },
      select: {
        id: true,
        email: true,
        subjectRef: true,
        fullName: true,
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

    if (!customer) {
      return res.status(404).json({
        ok: false,
        error: "Customer not found",
      });
    }

    return res.json({
      ok: true,
      customer: buildCustomerResponse(customer, email),
    });
  } catch (err) {
    console.error("meRoutes error:", err && err.stack ? err.stack : err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Server error",
    });
  }
}

// customer "me"
router.get("/customers/me", fetchCustomerByEmail);

// profile "me" (alias)
router.get("/profile/me", fetchCustomerByEmail);

// auth "me" (alias)
router.get("/auth/me", fetchCustomerByEmail);

module.exports = router;