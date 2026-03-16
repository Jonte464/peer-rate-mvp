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
  validateSwedishPersonalNumber,
  normSubject,
} = require("../helpers");

const prisma = new PrismaClient();
const router = express.Router();

const DEFAULT_TERMS_VERSION = "2026-03-16-v1";
const DEFAULT_PRIVACY_VERSION = "2026-03-16-v1";
const DEFAULT_REGISTRATION_METHOD = "email_password";

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

function fail(res, status, errorCode, error) {
  return res.status(status).json({
    ok: false,
    errorCode,
    error,
  });
}

function assignNormalizedCheckboxIfPresent(target, raw, key) {
  if (Object.prototype.hasOwnProperty.call(raw, key)) {
    target[key] = normalizeCheckbox(raw[key]);
  }
}

function safeErrMeta(err) {
  return {
    name: err?.name || null,
    message: err?.message || null,
    code: err?.code || null,
    clientVersion: err?.clientVersion || null,
    meta: err?.meta || null,
    stack: err?.stack || null,
  };
}

// Steg 1
const createCustomerStep1Schema = Joi.object({
  flowStep: Joi.string().valid("step1").required(),
  email: Joi.string().email().required(),
  emailConfirm: Joi.string().email().allow("", null).optional(),
  password: Joi.string().min(8).max(100).required(),
  passwordConfirm: Joi.string().min(8).max(100).required(),

  termsAccepted: Joi.boolean().valid(true).required(),
  privacyAccepted: Joi.boolean().valid(true).required(),

  termsVersionAccepted: Joi.string().max(100).allow("", null).optional(),
  privacyVersionAccepted: Joi.string().max(100).allow("", null).optional(),
  registrationMethod: Joi.string().max(100).allow("", null).optional(),

  thirdPartyConsent: Joi.boolean().valid(true).optional(),
});

// Steg 2
const createCustomerStep2Schema = Joi.object({
  flowStep: Joi.string().valid("step2").required(),
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  personalNumber: Joi.string().required(),

  email: Joi.string().email().required(),
  emailConfirm: Joi.string().email().required(),

  password: Joi.string().min(8).max(100).allow("", null).optional(),
  passwordConfirm: Joi.string().min(8).max(100).allow("", null).optional(),

  phone: Joi.string().pattern(/^[0-9+\s\-()]*$/).allow("", null),
  addressStreet: Joi.string().max(200).allow("", null),
  addressZip: Joi.string().max(20).allow("", null),
  addressCity: Joi.string().max(100).allow("", null),
  country: Joi.string().max(100).allow("", null),

  blocketEmail: Joi.string().email().allow("", null),
  blocketPassword: Joi.string().min(1).max(200).allow("", null),

  thirdPartyConsent: Joi.boolean().valid(true).optional(),
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
    case "flowStep":
      return "registreringssteg";
    default:
      return null;
  }
}

async function handleCreateOrUpdateCustomer(req, res) {
  const raw = req.body || {};

  const body = { ...raw };

  assignNormalizedCheckboxIfPresent(body, raw, "thirdPartyConsent");
  assignNormalizedCheckboxIfPresent(body, raw, "termsAccepted");
  assignNormalizedCheckboxIfPresent(body, raw, "privacyAccepted");

  const flowStep = String(body.flowStep || "").trim();

  if (flowStep !== "step1" && flowStep !== "step2") {
    return fail(
      res,
      400,
      "FLOW_STEP_REQUIRED",
      "Registreringssteget saknas eller är ogiltigt."
    );
  }

  if (
    flowStep === "step1" &&
    body.termsAccepted === true &&
    (raw.thirdPartyConsent === undefined ||
      raw.thirdPartyConsent === null ||
      raw.thirdPartyConsent === "")
  ) {
    body.thirdPartyConsent = true;
  }

  console.log("DEBUG /api/customers incoming:", {
    flowStep,
    email: body.email,
    termsAccepted:
      Object.prototype.hasOwnProperty.call(body, "termsAccepted") ? body.termsAccepted : undefined,
    privacyAccepted:
      Object.prototype.hasOwnProperty.call(body, "privacyAccepted") ? body.privacyAccepted : undefined,
    termsVersionAccepted: body.termsVersionAccepted || null,
    privacyVersionAccepted: body.privacyVersionAccepted || null,
    registrationMethod: body.registrationMethod || null,
    thirdPartyConsent: body.thirdPartyConsent,
    hasFirstName: !!body.firstName,
    hasPersonalNumber: !!body.personalNumber,
    addressStreet: body.addressStreet || null,
    addressZip: body.addressZip || null,
    addressCity: body.addressCity || null,
    country: body.country || null,
  });

  const schema =
    flowStep === "step2"
      ? createCustomerStep2Schema
      : createCustomerStep1Schema;

  const { error, value } = schema.validate(body, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    const firstDetail = error.details && error.details[0];
    const key =
      (firstDetail && firstDetail.context && firstDetail.context.key) ||
      (firstDetail && firstDetail.path && firstDetail.path[0]);

    const friendly = friendlyFieldName(key);
    const msg = friendly
      ? `Kontrollera fältet: ${friendly}.`
      : "En eller flera uppgifter är ogiltiga. Kontrollera formuläret.";

    console.error("DEBUG /api/customers validation error:", {
      flowStep,
      key,
      message: firstDetail?.message || error.message,
      details: error.details || null,
      bodyKeys: Object.keys(body),
    });

    return fail(res, 400, "FIELD_INVALID", msg);
  }

  const emailTrim = String(value.email || "").trim().toLowerCase();
  const emailConfirmTrim =
    String(value.emailConfirm || "").trim().toLowerCase() || emailTrim;

  if (!emailTrim || emailTrim !== emailConfirmTrim) {
    return fail(res, 400, "EMAIL_MISMATCH", "E-postadresserna matchar inte.");
  }

  const hasPasswordInRequest =
    typeof value.password === "string" && value.password.length > 0;

  if (flowStep === "step1" || hasPasswordInRequest) {
    if ((value.password || "") !== (value.passwordConfirm || "")) {
      return fail(res, 400, "PASSWORD_MISMATCH", "Lösenorden matchar inte.");
    }
  }

  const subjectRef = normSubject(emailTrim);
  const blocketEmail = (value.blocketEmail && String(value.blocketEmail).trim()) || "";
  const blocketPassword = value.blocketPassword || "";

  try {
    console.log("DEBUG /api/customers lookup start:", {
      flowStep,
      emailTrim,
      subjectRef,
    });

    const existingBySubject = await prisma.customer.findUnique({
      where: { subjectRef },
    });

    console.log("DEBUG /api/customers lookup result:", {
      flowStep,
      emailTrim,
      subjectRef,
      existingBySubjectId: existingBySubject?.id || null,
      existingBySubjectEmail: existingBySubject?.email || null,
      existingBySubjectHasPassword: !!existingBySubject?.passwordHash,
      existingBySubjectPersonalNumber: existingBySubject?.personalNumber || null,
    });

    let personalNumberClean = null;

    if (flowStep === "step2") {
      console.log("DEBUG /api/customers step2 before personal number validation:", {
        emailTrim,
        personalNumberRaw: value.personalNumber,
      });

      const pnValidation = validateSwedishPersonalNumber(value.personalNumber);

      console.log("DEBUG /api/customers step2 personal number validation result:", pnValidation);

      if (!pnValidation.ok) {
        return fail(
          res,
          400,
          pnValidation.code || "PERSONAL_NUMBER_INVALID",
          pnValidation.message || "Ogiltigt personnummer."
        );
      }

      personalNumberClean = pnValidation.normalized;

      const existingByPn = await prisma.customer.findUnique({
        where: { personalNumber: personalNumberClean },
      });

      console.log("DEBUG /api/customers step2 personal number lookup result:", {
        personalNumberClean,
        existingByPnId: existingByPn?.id || null,
        existingByPnEmail: existingByPn?.email || null,
      });

      if (existingByPn && (!existingBySubject || existingByPn.id !== existingBySubject.id)) {
        return fail(
          res,
          409,
          "PERSONAL_NUMBER_EXISTS",
          "Det finns redan en användare med samma personnummer."
        );
      }
    }

    const passwordHash =
      flowStep === "step1" || hasPasswordInRequest
        ? await bcrypt.hash(value.password, 10)
        : null;

    const fullName =
      flowStep === "step2"
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
      passwordHash,
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
    };

    console.log("DEBUG /api/customers write payload:", {
      flowStep,
      mode: existingBySubject ? "update" : "create",
      emailTrim,
      subjectRef,
      step1Data,
      step2Data,
    });

    let customer;

    if (existingBySubject) {
      if (flowStep === "step1" && existingBySubject.passwordHash) {
        return fail(
          res,
          409,
          "EMAIL_EXISTS",
          "Det finns redan ett registrerat konto med denna e-postadress."
        );
      }

      customer = await prisma.customer.update({
        where: { id: existingBySubject.id },
        data: flowStep === "step2" ? step2Data : step1Data,
      });
    } else {
      customer = await prisma.customer.create({
        data: flowStep === "step2" ? step2Data : step1Data,
      });
    }

    console.log("DEBUG /api/customers write success:", {
      flowStep,
      customerId: customer?.id || null,
      customerEmail: customer?.email || null,
      customerSubjectRef: customer?.subjectRef || null,
    });

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
      flow: flowStep,
    });
  } catch (e) {
    console.error("[POST /api/customers] error summary:", safeErrMeta(e));
    console.error("[POST /api/customers] error context:", {
      flowStep,
      rawBody: raw,
      normalizedBody: body,
      validatedEmail: emailTrim,
      validatedEmailConfirm: emailConfirmTrim,
    });

    if (e.code === "P2002") {
      return fail(
        res,
        409,
        "UNIQUE_CONSTRAINT",
        "Det finns redan en användare med samma e-post eller personnummer."
      );
    }

    if (e.code === "P2022") {
      return fail(
        res,
        500,
        "DB_COLUMN_MISSING",
        "Databasmodellen saknar ett förväntat fält."
      );
    }

    if (e.code === "P2003") {
      return fail(
        res,
        500,
        "DB_FOREIGN_KEY",
        "Databasen avvisade kopplingen mellan poster."
      );
    }

    return fail(res, 500, "CUSTOMER_CREATE_FAILED", "Kunde inte skapa eller uppdatera kund.");
  }
}

router.post("/customers", handleCreateOrUpdateCustomer);
router.post("/customers/register", handleCreateOrUpdateCustomer);

router.get("/customers", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    return fail(res, 400, "QUERY_REQUIRED", "Ange q i querystring.");
  }

  try {
    const customers = await searchCustomers(q);
    res.json({ ok: true, count: customers.length, customers });
  } catch (e) {
    console.error("[GET /api/customers] error:", e);
    return fail(res, 500, "CUSTOMER_FETCH_FAILED", "Kunde inte hämta kunder.");
  }
});

module.exports = router;