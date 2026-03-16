// backend/routes/customersRoutes.js

const express = require("express");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const { searchCustomers } = require("../storage");
const { connectBlocketProfile } = require("../services/blocketService");

const {
  clean,
  normalizePhone,
  normalizeCheckbox,
  isValidPersonalNumber,
  normSubject,
} = require("../helpers");

const prisma = new PrismaClient();
const router = express.Router();

const DEFAULT_TERMS_VERSION = "2026-03-16-v1";
const DEFAULT_PRIVACY_VERSION = "2026-03-16-v1";
const DEFAULT_REGISTRATION_METHOD = "email_password";

/**
 * =========================
 *  HELPERS
 * =========================
 */

function cleanOptionalString(value, maxLen = 255) {
  const v = clean(value);
  if (!v) return null;
  return String(v).slice(0, maxLen);
}

function getRequestIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim().slice(0, 100);
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim().slice(0, 100);
  }

  const socketIp =
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null;

  return socketIp ? String(socketIp).slice(0, 100) : null;
}

function getRequestUserAgent(req) {
  const ua = req.get("user-agent") || "";
  return ua ? String(ua).slice(0, 1000) : null;
}

/**
 * =========================
 *  SCHEMAS
 * =========================
 */

// Steg 1: Minimal registrering (email + lösenord + villkor)
const createCustomerStep1Schema = Joi.object({
  email: Joi.string().email().required(),
  emailConfirm: Joi.string().email().allow("", null).optional(), // om ej skickas -> vi sätter = email
  password: Joi.string().min(8).max(100).required(),
  passwordConfirm: Joi.string().min(8).max(100).required(),

  // Steg 1 kräver att användaren godkänner både villkor och privacy
  termsAccepted: Joi.boolean().valid(true).required(),
  privacyAccepted: Joi.boolean().valid(true).required(),

  // Versionsspårning / registreringsmetod
  termsVersionAccepted: Joi.string().max(100).allow("", null).optional(),
  privacyVersionAccepted: Joi.string().max(100).allow("", null).optional(),
  registrationMethod: Joi.string().max(100).allow("", null).optional(),

  // För MVP: om den skickas måste den vara true (annars optional)
  thirdPartyConsent: Joi.boolean().valid(true).optional(),
});

// Steg 2: Komplettera profil (personuppgifter etc)
const createCustomerStep2Schema = Joi.object({
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  personalNumber: Joi.string()
    .custom((value, helpers) => {
      if (!isValidPersonalNumber(value)) return helpers.error("any.invalid");
      return value;
    })
    .required(),

  email: Joi.string().email().required(),
  emailConfirm: Joi.string().email().required(),

  // I steg 2 brukar man INTE vilja byta lösenord här – men vi stödjer om det skickas
  password: Joi.string().min(8).max(100).allow("", null).optional(),
  passwordConfirm: Joi.string().min(8).max(100).allow("", null).optional(),

  phone: Joi.string().pattern(/^[0-9+\s\-()]*$/).allow("", null),
  addressStreet: Joi.string().max(200).allow("", null),
  addressZip: Joi.string().max(20).allow("", null),
  addressCity: Joi.string().max(100).allow("", null),
  country: Joi.string().max(100).allow("", null),

  // Blocket valfritt
  blocketEmail: Joi.string().email().allow("", null),
  blocketPassword: Joi.string().min(1).max(200).allow("", null),

  // Om de skickas måste de vara true
  thirdPartyConsent: Joi.boolean().valid(true).optional(),
  termsAccepted: Joi.boolean().valid(true).optional(),
  privacyAccepted: Joi.boolean().valid(true).optional(),
});

function friendlyFieldName(key) {
  switch (key) {
    case "firstName":
      return "förnamn";
    case "lastName":
      return "efternamn";
    case "personalNumber":
      return "personnummer";
    case "email":
      return "e-post";
    case "emailConfirm":
      return "bekräfta e-post";
    case "phone":
      return "telefonnummer";
    case "addressStreet":
      return "gatuadress";
    case "addressZip":
      return "postnummer";
    case "addressCity":
      return "ort";
    case "country":
      return "land";
    case "password":
      return "lösenord";
    case "passwordConfirm":
      return "bekräfta lösenord";
    case "blocketEmail":
      return "Blocket-e-post";
    case "blocketPassword":
      return "Blocket-lösenord";
    case "thirdPartyConsent":
      return "samtycke till tredjepartsdata";
    case "termsAccepted":
      return "godkännande av användarvillkor";
    case "privacyAccepted":
      return "godkännande av integritetspolicy";
    case "termsVersionAccepted":
      return "version för användarvillkor";
    case "privacyVersionAccepted":
      return "version för integritetspolicy";
    case "registrationMethod":
      return "registreringsmetod";
    default:
      return null;
  }
}

/**
 * ======================================================
 * Gemensam handler för:
 * - POST /api/customers
 * - POST /api/customers/register   (alias för frontend)
 * ======================================================
 */
async function handleCreateOrUpdateCustomer(req, res) {
  const raw = req.body || {};

  // Normalisera checkboxar
  const body = {
    ...raw,
    thirdPartyConsent: normalizeCheckbox(raw.thirdPartyConsent),
    termsAccepted: normalizeCheckbox(raw.termsAccepted),
    privacyAccepted: normalizeCheckbox(raw.privacyAccepted),
  };

  // Avgör om detta är steg 2
  const isStep2 =
    !!body.firstName ||
    !!body.lastName ||
    !!body.personalNumber ||
    !!body.addressStreet ||
    !!body.addressZip ||
    !!body.addressCity;

  // MVP-genväg: om termsAccepted=true i steg 1 men thirdPartyConsent saknas -> sätt true
  if (
    !isStep2 &&
    body.termsAccepted === true &&
    (raw.thirdPartyConsent === undefined ||
      raw.thirdPartyConsent === null ||
      raw.thirdPartyConsent === "")
  ) {
    body.thirdPartyConsent = true;
  }

  console.log("DEBUG /api/customers incoming:", {
    isStep2,
    email: body.email,
    termsAccepted: body.termsAccepted,
    privacyAccepted: body.privacyAccepted,
    termsVersionAccepted: body.termsVersionAccepted || null,
    privacyVersionAccepted: body.privacyVersionAccepted || null,
    registrationMethod: body.registrationMethod || null,
    thirdPartyConsent: body.thirdPartyConsent,
    hasFirstName: !!body.firstName,
    hasPersonalNumber: !!body.personalNumber,
  });

  const schema = isStep2 ? createCustomerStep2Schema : createCustomerStep1Schema;
  const { error, value } = schema.validate(body, { abortEarly: true });

  if (error) {
    const firstDetail = error.details && error.details[0];
    const key =
      (firstDetail && firstDetail.context && firstDetail.context.key) ||
      (firstDetail && firstDetail.path && firstDetail.path[0]);

    if (key === "personalNumber") {
      return res.status(400).json({ ok: false, error: "Ogiltigt personnummer." });
    }

    const friendly = friendlyFieldName(key);
    const msg = friendly
      ? `Kontrollera fältet: ${friendly}.`
      : "En eller flera uppgifter är ogiltiga. Kontrollera formuläret.";

    return res.status(400).json({ ok: false, error: msg });
  }

  // Email + confirm
  const emailTrim = String(value.email || "").trim().toLowerCase();
  const emailConfirmTrim =
    String(value.emailConfirm || "").trim().toLowerCase() || emailTrim;

  if (!emailTrim || emailTrim !== emailConfirmTrim) {
    return res.status(400).json({ ok: false, error: "E-postadresserna matchar inte." });
  }

  // Password + confirm
  const hasPasswordInRequest = typeof value.password === "string" && value.password.length > 0;
  if (!isStep2 || hasPasswordInRequest) {
    if ((value.password || "") !== (value.passwordConfirm || "")) {
      return res.status(400).json({ ok: false, error: "Lösenorden matchar inte." });
    }
  }

  const subjectRef = normSubject(emailTrim);

  // Blocket (valfritt)
  const blocketEmail = (value.blocketEmail && String(value.blocketEmail).trim()) || "";
  const blocketPassword = value.blocketPassword || "";

  try {
    const existingBySubject = await prisma.customer.findUnique({
      where: { subjectRef },
    });

    // Om steg 2: kontrollera personnummer-unikhet
    let personalNumberClean = null;
    if (isStep2) {
      personalNumberClean = clean(value.personalNumber);
      const existingByPn = await prisma.customer.findUnique({
        where: { personalNumber: personalNumberClean },
      });

      if (existingByPn && (!existingBySubject || existingByPn.id !== existingBySubject.id)) {
        return res.status(409).json({
          ok: false,
          error: "Det finns redan en användare med samma personnummer.",
        });
      }
    }

    // Hasha lösenord om vi ska spara/uppdatera
    const passwordHash =
      !isStep2 || hasPasswordInRequest ? await bcrypt.hash(value.password, 10) : null;

    const fullName = isStep2
      ? `${clean(value.firstName) || ""} ${clean(value.lastName) || ""}`.trim() || null
      : null;

    const now = new Date();
    const effectiveTermsVersion =
      cleanOptionalString(value.termsVersionAccepted, 100) || DEFAULT_TERMS_VERSION;
    const effectivePrivacyVersion =
      cleanOptionalString(value.privacyVersionAccepted, 100) || DEFAULT_PRIVACY_VERSION;
    const effectiveRegistrationMethod =
      cleanOptionalString(value.registrationMethod, 100) || DEFAULT_REGISTRATION_METHOD;

    const requestIp = getRequestIp(req);
    const requestUserAgent = getRequestUserAgent(req);

    const step1Data = {
      subjectRef,
      email: emailTrim,
      passwordHash, // alltid i steg 1
      thirdPartyConsent: value.thirdPartyConsent === true,
      termsAccepted: true,
      privacyAccepted: true,
      termsAcceptedAt: existingBySubject?.termsAcceptedAt || now,
      termsVersionAccepted: existingBySubject?.termsVersionAccepted || effectiveTermsVersion,
      privacyAcceptedAt: existingBySubject?.privacyAcceptedAt || now,
      privacyVersionAccepted: existingBySubject?.privacyVersionAccepted || effectivePrivacyVersion,
      registrationMethod: existingBySubject?.registrationMethod || effectiveRegistrationMethod,
      registrationIp: existingBySubject?.registrationIp || requestIp,
      registrationUserAgent: existingBySubject?.registrationUserAgent || requestUserAgent,
    };

    const step2Data = {
      subjectRef,
      email: emailTrim,
      fullName,
      personalNumber: personalNumberClean,
      phone: normalizePhone(value.phone),
      addressStreet: clean(value.addressStreet),
      addressZip: clean(value.addressZip),
      addressCity: clean(value.addressCity),
      country: clean(value.country),
      ...(passwordHash ? { passwordHash } : {}),
      ...(value.thirdPartyConsent === true ? { thirdPartyConsent: true } : {}),
      ...(value.termsAccepted === true ? { termsAccepted: true } : {}),
      ...(value.privacyAccepted === true ? { privacyAccepted: true } : {}),
    };

    let customer;

    if (existingBySubject) {
      // Om konto redan “riktigt” och vi är i steg 1 => blocka dubbelregistrering
      if (!isStep2 && existingBySubject.passwordHash) {
        return res.status(409).json({
          ok: false,
          error: "Det finns redan ett registrerat konto med denna e-postadress.",
        });
      }

      customer = await prisma.customer.update({
        where: { id: existingBySubject.id },
        data: isStep2 ? step2Data : step1Data,
      });
    } else {
      customer = await prisma.customer.create({
        data: isStep2 ? step2Data : step1Data,
      });
    }

    // Blocket-koppling i bakgrunden (om båda finns)
    if (blocketEmail && blocketPassword) {
      connectBlocketProfile(customer.id, blocketEmail, blocketPassword)
        .then(() => console.log(`Blocket-profil kopplad för kund ${customer.id}`))
        .catch((err) =>
          console.error(`Misslyckades koppla Blocket-profil för kund ${customer.id}`, err)
        );
    }

    return res.status(existingBySubject ? 200 : 201).json({
      ok: true,
      customer: {
        id: customer.id,
        fullName: customer.fullName || null,
        email: customer.email,
        subjectRef: customer.subjectRef,
      },
      flow: isStep2 ? "step2" : "step1",
    });
  } catch (e) {
    console.error("[POST /api/customers] error:", e);

    if (e.code === "P2002") {
      return res.status(409).json({
        ok: false,
        error: "Det finns redan en användare med samma e-post eller personnummer.",
      });
    }

    return res.status(500).json({ ok: false, error: "Kunde inte skapa kund." });
  }
}

/**
 * =========================
 *  POST endpoints
 * =========================
 */
router.post("/customers", handleCreateOrUpdateCustomer);

// ✅ Alias som din frontend redan använder:
router.post("/customers/register", handleCreateOrUpdateCustomer);

/**
 * =========================
 * GET /api/customers – sök kunder (admin)
 * =========================
 */
router.get("/customers", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    return res.status(400).json({ ok: false, error: "Ange q i querystring." });
  }

  try {
    const customers = await searchCustomers(q);
    res.json({ ok: true, count: customers.length, customers });
  } catch (e) {
    console.error("[GET /api/customers] error:", e);
    res.status(500).json({ ok: false, error: "Kunde inte hämta kunder" });
  }
});

module.exports = router;