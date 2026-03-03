// backend/routes/ratingsRoutes.js
// Prisma-first implementation för POST/GET ratings (stabil efter DB-reset)

const express = require("express");
const Joi = require("joi");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const { nowIso, normSubject, mapReportReason } = require("../helpers");

const router = express.Router();

/** Mappa svensk benämning -> enum RatingSource */
function mapRatingSource(input) {
  if (!input) return "OTHER";
  const v = String(input).trim().toLowerCase();

  if (v.includes("blocket")) return "BLOCKET";
  if (v.includes("tradera")) return "TRADERA";
  if (v.includes("airbnb")) return "AIRBNB";
  if (v.includes("husknuten")) return "HUSKNUTEN";
  if (v.includes("tiptap")) return "TIPTAP";

  return "OTHER";
}

function mapExternalPlatform(input) {
  if (!input) return "BLOCKET";
  const v = String(input).trim().toUpperCase();
  if (v.includes("TRADERA")) return "TRADERA";
  if (v.includes("EBAY")) return "EBAY";
  if (v.includes("BLOCKET")) return "BLOCKET";
  return "BLOCKET";
}

function isEmail(s) {
  const v = String(s || "").trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// --- Validation ---

const reportSchema = Joi.object({
  report_flag: Joi.boolean().optional(),
  report_reason: Joi.string().allow("", null),
  report_text: Joi.string().allow("", null),
  evidence_url: Joi.string().uri().allow("", null),
  report_consent: Joi.boolean().optional(),
}).unknown(true);

const counterpartySchema = Joi.object({
  email: Joi.string().email().required(),

  username: Joi.string().max(60).allow("", null),
  platformUsername: Joi.string().max(60).allow("", null),

  name: Joi.string().max(120).allow("", null),
  phone: Joi.string().max(40).allow("", null),
  addressStreet: Joi.string().max(120).allow("", null),
  addressZip: Joi.string().max(20).allow("", null),
  addressCity: Joi.string().max(80).allow("", null),
  country: Joi.string().max(60).allow("", null),

  platform: Joi.string().max(30).allow("", null),
  pageUrl: Joi.string().uri().allow("", null),

  orderId: Joi.string().max(80).allow("", null),
  itemId: Joi.string().max(80).allow("", null),
  amountSek: Joi.number().integer().min(0).max(100000000).allow(null),
  title: Joi.string().max(200).allow("", null),
}).unknown(true).optional();

const dealSchema = Joi.object({
  platform: Joi.string().max(30).allow("", null),
  orderId: Joi.string().max(80).allow("", null),
  itemId: Joi.string().max(80).allow("", null),
  title: Joi.string().max(200).allow("", null),
  amount: Joi.alternatives(Joi.number(), Joi.string()).allow(null),
  amountSek: Joi.number().integer().min(0).max(100000000).allow(null),
  currency: Joi.string().max(10).allow("", null),
  date: Joi.string().max(40).allow("", null),
  dateISO: Joi.string().max(40).allow("", null),
  pageUrl: Joi.string().uri().allow("", null),
}).unknown(true).optional();

const createRatingSchema = Joi.object({
  subject: Joi.string().min(2).max(200).required(),
  rater: Joi.string().min(2).max(200).allow("", null).optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow("", null),
  proofRef: Joi.string().max(200).allow("", null),
  source: Joi.string().allow("", null),

  report: reportSchema.optional(),
  counterparty: counterpartySchema,
  deal: dealSchema,
}).unknown(true);

function looksLikePhone(s) {
  const v = String(s || "").trim();
  if (!v) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 6;
}

async function ensureCustomerBySubjectRef(subjectRef, emailMaybe) {
  if (!subjectRef) return null;

  const existing = await prisma.customer.findUnique({ where: { subjectRef } });
  if (existing) return existing;

  // Skapa minimal customer om den saknas (krävs för rating.customerId)
  const email = (emailMaybe || "").trim().toLowerCase() || subjectRef;

  return prisma.customer.create({
    data: {
      subjectRef,
      email,
      country: "SE",
      termsAccepted: true,
      thirdPartyConsent: true,
    },
  });
}

async function upsertCounterpartyDossier(counterparty) {
  if (!counterparty || !counterparty.email) return;

  const cp = { ...counterparty };

  // om name råkar innehålla telefon
  if ((!cp.phone || !String(cp.phone).trim()) && looksLikePhone(cp.name)) {
    cp.phone = cp.name;
    cp.name = null;
  }

  const subjectRef = normSubject(cp.email);
  if (!subjectRef) return;

  const existing = await prisma.customer.findUnique({ where: { subjectRef } });

  if (!existing) {
    await prisma.customer.create({
      data: {
        subjectRef,
        email: cp.email.toLowerCase(),
        fullName: cp.name || null,
        phone: cp.phone || null,
        addressStreet: cp.addressStreet || null,
        addressZip: cp.addressZip || null,
        addressCity: cp.addressCity || null,
        country: cp.country || "SE",
        termsAccepted: true,
        thirdPartyConsent: true,
      },
    });
  } else {
    const dataToUpdate = {};
    if (!existing.email) dataToUpdate.email = cp.email.toLowerCase();
    if (!existing.fullName && cp.name) dataToUpdate.fullName = cp.name;
    if (!existing.phone && cp.phone) dataToUpdate.phone = cp.phone;
    if (!existing.addressStreet && cp.addressStreet) dataToUpdate.addressStreet = cp.addressStreet;
    if (!existing.addressZip && cp.addressZip) dataToUpdate.addressZip = cp.addressZip;
    if (!existing.addressCity && cp.addressCity) dataToUpdate.addressCity = cp.addressCity;
    if (!existing.country && cp.country) dataToUpdate.country = cp.country;

    if (Object.keys(dataToUpdate).length) {
      await prisma.customer.update({ where: { subjectRef }, data: dataToUpdate });
    }
  }

  // Externa profiler (endast Tradera i din tidigare kod)
  const platform = (cp.platform || "").toString().toUpperCase();
  const username = cp.platformUsername || cp.username || null;

  if (platform === "TRADERA" && username) {
    const customer = await prisma.customer.findUnique({ where: { subjectRef } });
    if (!customer) return;

    const found = await prisma.externalProfile.findFirst({
      where: { customerId: customer.id, platform: "TRADERA", username },
    });

    if (!found) {
      await prisma.externalProfile.create({
        data: {
          customerId: customer.id,
          platform: "TRADERA",
          username,
          profileJson: cp.pageUrl ? { pageUrl: cp.pageUrl } : undefined,
        },
      });
    }
  }
}

/* -------------------------------------------------------
   POST /api/ratings – skapa betyg
   ------------------------------------------------------- */
router.post("/ratings", async (req, res) => {
  const { error, value } = createRatingSchema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      ok: false,
      error: "Ogiltig inmatning",
      details: error.details,
    });
  }

  const subjectRef = normSubject(value.subject);
  if (!subjectRef) {
    return res.status(400).json({ ok: false, error: "Ogiltigt subject." });
  }

  const score = value.rating;
  const text = (value.comment || "").toString().trim();
  const ratingSource = mapRatingSource(value.source);

  const raterRaw = (value.rater || "").toString().trim() || null;
  const raterEmail = raterRaw && isEmail(raterRaw) ? raterRaw.toLowerCase() : null;
  const raterName = raterEmail ? null : raterRaw;

  // proofRef: explicit proofRef annars deal.orderId
  const proofRef =
    (value.proofRef || "").toString().trim() ||
    (value.deal?.orderId ? String(value.deal.orderId).trim() : "") ||
    null;

  // säkerhetskontroll: counterparty.email måste matcha subject (om den skickas)
  if (value.counterparty?.email) {
    const a = normSubject(value.subject);
    const b = normSubject(value.counterparty.email);
    if (a && b && a !== b) {
      return res.status(400).json({
        ok: false,
        error: "Subject matchar inte counterparty.email (säkerhetskontroll).",
      });
    }
  }

  try {
    // 0) säkerställ att subject-kunden finns
    const subjectCustomer = await ensureCustomerBySubjectRef(subjectRef, value.subject);

    // 1) Upsert deal (om vi har deal/orderId)
    let dealId = null;
    const deal = value.deal || null;

    if (deal && (deal.orderId || proofRef)) {
      const platform = mapExternalPlatform(deal.platform || value.source);
      const externalProofRef = (deal.orderId ? String(deal.orderId).trim() : String(proofRef || "").trim()) || null;

      if (externalProofRef) {
        const amountSek =
          typeof deal.amountSek === "number"
            ? deal.amountSek
            : (typeof deal.amount === "number" ? Math.round(deal.amount) : null);

        const upserted = await prisma.deal.upsert({
          where: {
            platform_externalProofRef: {
              platform,
              externalProofRef,
            },
          },
          update: {
            externalItemId: deal.itemId ? String(deal.itemId).trim() : undefined,
            externalPageUrl: deal.pageUrl ? String(deal.pageUrl).trim() : undefined,
            title: deal.title ? String(deal.title).trim() : undefined,
            amount: amountSek != null ? amountSek : undefined, // prisma Decimal accepterar number
            currency: deal.currency ? String(deal.currency).trim() : undefined,
            status: "PENDING_RATING",
            source: platform === "TRADERA" ? "TRADERA_EXTENSION" : "MANUAL",
          },
          create: {
            sellerId: subjectCustomer.id,
            buyerId: null,
            platform,
            source: platform === "TRADERA" ? "TRADERA_EXTENSION" : "MANUAL",
            status: "PENDING_RATING",
            externalProofRef,
            externalItemId: deal.itemId ? String(deal.itemId).trim() : null,
            externalPageUrl: deal.pageUrl ? String(deal.pageUrl).trim() : null,
            title: deal.title ? String(deal.title).trim() : null,
            amount: amountSek != null ? amountSek : null,
            currency: deal.currency ? String(deal.currency).trim() : "SEK",
            completedAt: deal.dateISO ? new Date(String(deal.dateISO)) : null,
          },
        });

        dealId = upserted.id;
      }
    }

    // 2) skapa rating
    const created = await prisma.rating.create({
      data: {
        customerId: subjectCustomer.id,
        score,
        ratingSource,
        text: text || null,
        raterName,
        raterEmail,
        proofRef,
        dealId,
        createdAt: new Date(nowIso()),
      },
    });

    // 3) spara kundakt (motpart) om vi fick in counterparty
    if (value.counterparty) {
      await upsertCounterpartyDossier(value.counterparty);
    }

    // 4) ev report
    const r = value.report || null;
    if (r) {
      const flagged = r.report_flag === true || !!r.report_reason || !!r.report_text;
      const consentOk = r.report_consent === undefined ? true : !!r.report_consent;

      if (flagged && consentOk) {
        const reasonEnum = mapReportReason(r.report_reason) || "OTHER";
        await prisma.report.create({
          data: {
            reportedCustomerId: subjectCustomer.id,
            ratingId: created.id,
            reason: reasonEnum,
            details: r.report_text || null,
            evidenceUrl: r.evidence_url || null,
            reporterConsent: true,
          },
        });
      }
    }

    return res.status(201).json({ ok: true, ratingId: created.id });
  } catch (e) {
    // Prisma unique constraint
    if (e && e.code === "P2002") {
      return res.status(409).json({
        ok: false,
        error: "Omdöme verkar redan finnas (unikhetsregel).",
        code: "DUPLICATE",
      });
    }

    // Viktigt: logga HELA felet i Render så vi kan se exakt orsak
    console.error("[POST /api/ratings] error:", e && e.stack ? e.stack : e);

    // Returnera “detail” så vi slipper gissa nästa gång
    return res.status(500).json({
      ok: false,
      error: "Kunde inte spara betyg",
      detail: e && e.message ? e.message : String(e),
    });
  }
});

/* -------------------------------------------------------
   GET /api/ratings?subject=... – lista betyg
   ------------------------------------------------------- */
router.get("/ratings", async (req, res) => {
  const subject = normSubject(req.query.subject || "");
  if (!subject) return res.status(400).json({ ok: false, error: "Ange subject i querystring." });

  try {
    const customer = await prisma.customer.findUnique({ where: { subjectRef: subject } });
    if (!customer) return res.json({ ok: true, count: 0, ratings: [] });

    const ratings = await prisma.rating.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return res.json({ ok: true, count: ratings.length, ratings });
  } catch (e) {
    console.error("[GET /api/ratings] error:", e && e.stack ? e.stack : e);
    return res.status(500).json({ ok: false, error: "Kunde inte hämta betyg" });
  }
});

router.get("/ratings/average", async (req, res) => {
  const subject = normSubject(req.query.subject || "");
  if (!subject) return res.status(400).json({ ok: false, error: "Ange subject i querystring." });

  try {
    const customer = await prisma.customer.findUnique({ where: { subjectRef: subject } });
    if (!customer) return res.json({ ok: true, subject, count: 0, average: null });

    const agg = await prisma.rating.aggregate({
      where: { customerId: customer.id },
      _count: { _all: true },
      _avg: { score: true },
    });

    return res.json({
      ok: true,
      subject,
      count: agg._count._all,
      average: agg._avg.score,
    });
  } catch (e) {
    console.error("[GET /api/ratings/average] error:", e && e.stack ? e.stack : e);
    return res.status(500).json({ ok: false, error: "Kunde inte beräkna snitt" });
  }
});

router.get("/ratings/recent", async (_req, res) => {
  try {
    const ratings = await prisma.rating.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return res.json({ ok: true, ratings });
  } catch (e) {
    console.error("[GET /api/ratings/recent] error:", e && e.stack ? e.stack : e);
    return res.status(500).json({ ok: false, error: "Kunde inte hämta senaste" });
  }
});

module.exports = router;