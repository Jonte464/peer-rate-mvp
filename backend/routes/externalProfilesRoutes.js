// backend/routes/externalProfilesRoutes.js
const express = require("express");
const Joi = require("joi");
const { PrismaClient } = require("@prisma/client");

const prisma = global.prisma || new PrismaClient();
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

function normalizeProfileEmail(input) {
  return String(input || "").trim().toLowerCase();
}

function normalizeNoAccount(input) {
  return input === true;
}

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

function toApiProfile(row) {
  if (!row) return null;

  const rawUsername = String(row.username || "").trim();
  const rawEmail = String(row.email || "").trim();
  const rawStatus = String(row.status || "").trim().toUpperCase();

  const noAccount = rawStatus === "NO_ACCOUNT" || rawUsername === "__NO_ACCOUNT__";

  return {
    id: row.id,
    platform: row.platform,
    username: noAccount ? "" : rawUsername,
    email: noAccount ? "" : rawEmail,
    status: noAccount ? "NO_ACCOUNT" : (rawStatus || "ACTIVE"),
    updatedAt: row.updatedAt,
  };
}

function isUnsupportedEnumValueError(err, fieldName) {
  const msg = String(err && err.message ? err.message : "");
  return (
    msg.includes(`argument \`${fieldName}\``) ||
    (msg.includes(fieldName) && msg.includes("Invalid value")) ||
    (msg.includes(fieldName) && msg.includes("Value") && msg.includes("not found in enum"))
  );
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

async function findAllProfilesForCustomer(customerId) {
  return prisma.externalProfile.findMany({
    where: {
      customerId,
    },
    select: {
      id: true,
      platform: true,
      username: true,
      email: true,
      status: true,
      updatedAt: true,
    },
    orderBy: [
      { updatedAt: "desc" },
      { id: "desc" },
    ],
  });
}

async function findProfilesForPlatform(customerId, platform) {
  const rows = await findAllProfilesForCustomer(customerId);
  return rows.filter((row) => row.platform === platform);
}

const saveSchema = Joi.object({
  platform: Joi.string().required(),
  username: Joi.string().allow("", null).optional(),
  email: Joi.string().allow("", null).optional(),
  noAccount: Joi.boolean().optional(),
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

    const rows = await findAllProfilesForCustomer(customer.id);
    const byPlatform = emptyProfilesMap();

    for (const row of rows) {
      if (!SUPPORTED_PLATFORMS.includes(row.platform)) continue;
      if (!byPlatform[row.platform]) {
        byPlatform[row.platform] = toApiProfile(row);
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
    const email = normalizeProfileEmail(value.email);
    const noAccount = normalizeNoAccount(value.noAccount);

    if (!platform) {
      return res.status(400).json({
        ok: false,
        error: "Unsupported platform",
      });
    }

    const existingRows = await findProfilesForPlatform(customer.id, platform);
    const latestExisting = existingRows[0] || null;

    // Om användaren uttryckligen saknar konto
    if (noAccount) {
      try {
        let saved;

        if (latestExisting?.id) {
          saved = await prisma.externalProfile.update({
            where: { id: latestExisting.id },
            data: {
              username: "__NO_ACCOUNT__",
              email: null,
              status: "NO_ACCOUNT",
            },
            select: {
              id: true,
              platform: true,
              username: true,
              email: true,
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
              email: null,
              status: "NO_ACCOUNT",
            },
            select: {
              id: true,
              platform: true,
              username: true,
              email: true,
              status: true,
              updatedAt: true,
            },
          });
        }

        return res.json({
          ok: true,
          profile: toApiProfile(saved),
        });
      } catch (err) {
        // Fallback om NO_ACCOUNT ännu inte finns i deployad enum
        if (isUnsupportedEnumValueError(err, "status")) {
          try {
            let savedFallback;

            if (latestExisting?.id) {
              savedFallback = await prisma.externalProfile.update({
                where: { id: latestExisting.id },
                data: {
                  username: "__NO_ACCOUNT__",
                  email: null,
                  status: "DISABLED",
                },
                select: {
                  id: true,
                  platform: true,
                  username: true,
                  email: true,
                  status: true,
                  updatedAt: true,
                },
              });
            } else {
              savedFallback = await prisma.externalProfile.create({
                data: {
                  customerId: customer.id,
                  platform,
                  username: "__NO_ACCOUNT__",
                  email: null,
                  status: "DISABLED",
                },
                select: {
                  id: true,
                  platform: true,
                  username: true,
                  email: true,
                  status: true,
                  updatedAt: true,
                },
              });
            }

            return res.json({
              ok: true,
              profile: toApiProfile(savedFallback),
            });
          } catch (fallbackErr) {
            if (isUnsupportedEnumValueError(fallbackErr, "platform")) {
              return res.status(400).json({
                ok: false,
                error: "Platform not yet enabled in backend schema",
              });
            }

            console.error("[POST /api/external-profiles] no-account fallback error:", fallbackErr && fallbackErr.stack ? fallbackErr.stack : fallbackErr);
            return res.status(500).json({
              ok: false,
              error: "Could not save external profile",
            });
          }
        }

        if (isUnsupportedEnumValueError(err, "platform")) {
          return res.status(400).json({
            ok: false,
            error: "Platform not yet enabled in backend schema",
          });
        }

        throw err;
      }
    }

    // Om användaren aktiverar konto men lämnar båda tomma => ta bort helt
    if (!username && !email) {
      if (existingRows.length) {
        await prisma.externalProfile.deleteMany({
          where: {
            id: {
              in: existingRows.map((row) => row.id),
            },
          },
        });
      }

      return res.json({
        ok: true,
        removed: true,
        platform,
      });
    }

    try {
      let saved;

      if (latestExisting?.id) {
        saved = await prisma.externalProfile.update({
          where: { id: latestExisting.id },
          data: {
            username: username || "",
            email: email || null,
            status: "ACTIVE",
          },
          select: {
            id: true,
            platform: true,
            username: true,
            email: true,
            status: true,
            updatedAt: true,
          },
        });
      } else {
        saved = await prisma.externalProfile.create({
          data: {
            customerId: customer.id,
            platform,
            username: username || "",
            email: email || null,
            status: "ACTIVE",
          },
          select: {
            id: true,
            platform: true,
            username: true,
            email: true,
            status: true,
            updatedAt: true,
          },
        });
      }

      // Städar gamla dubletter för samma customer+platform
      if (existingRows.length > 1) {
        const duplicateIds = existingRows
          .slice(1)
          .map((row) => row.id)
          .filter(Boolean);

        if (duplicateIds.length) {
          await prisma.externalProfile.deleteMany({
            where: {
              id: {
                in: duplicateIds,
              },
            },
          });
        }
      }

      return res.json({
        ok: true,
        profile: toApiProfile(saved),
      });
    } catch (err) {
      if (isUnsupportedEnumValueError(err, "platform")) {
        return res.status(400).json({
          ok: false,
          error: "Platform not yet enabled in backend schema",
        });
      }

      if (isUnsupportedEnumValueError(err, "status")) {
        return res.status(400).json({
          ok: false,
          error: "Status not yet enabled in backend schema",
        });
      }

      throw err;
    }
  } catch (err) {
    console.error("[POST /api/external-profiles] error:", err && err.stack ? err.stack : err);
    return res.status(500).json({
      ok: false,
      error: "Could not save external profile",
    });
  }
});

module.exports = router;