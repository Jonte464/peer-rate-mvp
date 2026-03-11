// backend/routes/externalProfilesRoutes.js
const express = require("express");
const Joi = require("joi");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

function getEmailFromReq(req) {
  const h = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (h) return h;

  const q = String(req.query.email || "").trim().toLowerCase();
  if (q) return q;

  return "";
}

function normalizePlatform(input) {
  const v = String(input || "").trim().toUpperCase();
  if (v === "TRADERA") return "TRADERA";
  if (v === "BLOCKET") return "BLOCKET";
  if (v === "EBAY") return "EBAY";
  return "";
}

function normalizeUsername(input) {
  return String(input || "").trim();
}

async function findCustomerByIdentity(req) {
  const email = getEmailFromReq(req);
  if (!email) return null;

  return prisma.customer.findFirst({
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
    },
  });
}

const saveSchema = Joi.object({
  platform: Joi.string().required(),
  username: Joi.string().allow("", null).optional(),
}).required();

router.get("/external-profiles", async (req, res) => {
  try {
    const customer = await findCustomerByIdentity(req);

    if (!customer) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated",
      });
    }

    const rows = await prisma.externalProfile.findMany({
      where: {
        customerId: customer.id,
        platform: {
          in: ["TRADERA", "BLOCKET", "EBAY"],
        },
      },
      select: {
        id: true,
        platform: true,
        username: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const byPlatform = {
      TRADERA: null,
      BLOCKET: null,
      EBAY: null,
    };

    for (const row of rows) {
      if (!byPlatform[row.platform]) {
        byPlatform[row.platform] = {
          id: row.id,
          platform: row.platform,
          username: row.username,
          status: row.status,
          updatedAt: row.updatedAt,
        };
      }
    }

    return res.json({
      ok: true,
      profiles: byPlatform,
    });
  } catch (err) {
    console.error("[GET /api/external-profiles] error:", err && err.stack ? err.stack : err);
    return res.status(500).json({
      ok: false,
      error: "Could not load external profiles",
    });
  }
});

router.post("/external-profiles", async (req, res) => {
  const { error, value } = saveSchema.validate(req.body, { abortEarly: true });

  if (error) {
    return res.status(400).json({
      ok: false,
      error: "Invalid input",
    });
  }

  try {
    const customer = await findCustomerByIdentity(req);

    if (!customer) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated",
      });
    }

    const platform = normalizePlatform(value.platform);
    const username = normalizeUsername(value.username);

    if (!platform) {
      return res.status(400).json({
        ok: false,
        error: "Unsupported platform",
      });
    }

    const existing = await prisma.externalProfile.findFirst({
      where: {
        customerId: customer.id,
        platform,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
      },
    });

    // Tom username = ta bort koppling för plattformen
    if (!username) {
      if (existing?.id) {
        await prisma.externalProfile.delete({
          where: { id: existing.id },
        });
      }

      return res.json({
        ok: true,
        removed: true,
        platform,
      });
    }

    let saved;

    if (existing?.id) {
      saved = await prisma.externalProfile.update({
        where: { id: existing.id },
        data: {
          username,
          status: "ACTIVE",
        },
        select: {
          id: true,
          platform: true,
          username: true,
          status: true,
          updatedAt: true,
        },
      });
    } else {
      saved = await prisma.externalProfile.create({
        data: {
          customerId: customer.id,
          platform,
          username,
          status: "ACTIVE",
        },
        select: {
          id: true,
          platform: true,
          username: true,
          status: true,
          updatedAt: true,
        },
      });
    }

    return res.json({
      ok: true,
      profile: saved,
    });
  } catch (err) {
    console.error("[POST /api/external-profiles] error:", err && err.stack ? err.stack : err);
    return res.status(500).json({
      ok: false,
      error: "Could not save external profile",
    });
  }
});

module.exports = router;