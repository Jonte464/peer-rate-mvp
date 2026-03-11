// backend/routes/externalProfilesRoutes.js
const express = require("express");
const Joi = require("joi");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

const SUPPORTED_PLATFORMS = [
  "TRADERA",
  "BLOCKET",
  "AIRBNB",
  "EBAY",
  "TIPTAP",
  "HYGGLO",
  "HUSKNUTEN",
  "FACEBOOK",
];

function getEmailFromReq(req) {
  const h = String(req.headers["x-user-email"] || "").trim().toLowerCase();
  if (h) return h;

  const q = String(req.query.email || "").trim().toLowerCase();
  if (q) return q;

  return "";
}

function normalizePlatform(input) {
  const v = String(input || "").trim().toUpperCase();
  return SUPPORTED_PLATFORMS.includes(v) ? v : "";
}

function normalizeUsername(input) {
  return String(input || "").trim();
}

function normalizeNoAccount(input) {
  return input === true;
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
  noAccount: Joi.boolean().optional(),
}).required();

function emptyProfilesMap() {
  return {
    TRADERA: null,
    BLOCKET: null,
    AIRBNB: null,
    EBAY: null,
    TIPTAP: null,
    HYGGLO: null,
    HUSKNUTEN: null,
    FACEBOOK: null,
  };
}

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
          in: SUPPORTED_PLATFORMS,
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

    const byPlatform = emptyProfilesMap();

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
    const noAccount = normalizeNoAccount(value.noAccount);

    if (!platform) {
      return res.status(400).json({
        ok: false,
        error: "Unsupported platform",
      });
    }

    const existing = await prisma.externalProfile.findUnique({
      where: {
        customerId_platform: {
          customerId: customer.id,
          platform,
        },
      },
      select: {
        id: true,
        platform: true,
        username: true,
        status: true,
      },
    });

    // Om användaren uttryckligen saknar konto
    if (noAccount) {
      let saved;

      if (existing?.id) {
        saved = await prisma.externalProfile.update({
          where: { id: existing.id },
          data: {
            username: "__NO_ACCOUNT__",
            status: "NO_ACCOUNT",
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
            username: "__NO_ACCOUNT__",
            status: "NO_ACCOUNT",
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
    }

    // Tomt username och inte "saknar konto" => ta bort koppling helt
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