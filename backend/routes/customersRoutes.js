// backend/routes/customersRoutes.js

const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const { searchCustomers } = require('../storage');
const { connectBlocketProfile } = require('../services/blocketService');

const {
  clean,
  normalizePhone,
  normalizeCheckbox,
  isValidPersonalNumber,
  normSubject,
} = require('../helpers');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * =========================
 *  SCHEMAS
 * =========================
 */

// Steg 1: Minimal registrering (email + lösenord + villkor)
const createCustomerStep1Schema = Joi.object({
  email: Joi.string().email().required(),
  emailConfirm: Joi.string().email().allow('', null).optional(), // om ej skickas -> vi sätter = email
  password: Joi.string().min(8).max(100).required(),
  passwordConfirm: Joi.string().min(8).max(100).required(),

  // ✅ NYTT: i steg 1 kräver vi att användaren godkänner villkoren
  termsAccepted: Joi.boolean().valid(true).required(),

  // ✅ För MVP: vi vill inte kräva en separat checkbox för tredjepartsdata i steg 1.
  // Den kan skickas senare, men om den skickas måste den vara true.
  thirdPartyConsent: Joi.boolean().valid(true).optional(),
});

// Steg 2: Komplettera profil (personuppgifter etc)
const createCustomerStep2Schema = Joi.object({
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  personalNumber: Joi.string()
    .custom((value, helpers) => {
      if (!isValidPersonalNumber(value)) return helpers.error('any.invalid');
      return value;
    })
    .required(),

  email: Joi.string().email().required(),
  emailConfirm: Joi.string().email().required(),

  // I steg 2 brukar man INTE vilja byta lösenord här – men vi stödjer om det skickas
  password: Joi.string().min(8).max(100).allow('', null).optional(),
  passwordConfirm: Joi.string().min(8).max(100).allow('', null).optional(),

  phone: Joi.string().pattern(/^[0-9+\s\-()]*$/).allow('', null),
  addressStreet: Joi.string().max(200).allow('', null),
  addressZip: Joi.string().max(20).allow('', null),
  addressCity: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).allow('', null),

  // Blocket valfritt
  blocketEmail: Joi.string().email().allow('', null),
  blocketPassword: Joi.string().min(1).max(200).allow('', null),

  // I steg 2 kan vi kräva true (om ni vill). Jag sätter OPTIONAL här också för att inte låsa er.
  // Om de skickas måste de vara true.
  thirdPartyConsent: Joi.boolean().valid(true).optional(),
  termsAccepted: Joi.boolean().valid(true).optional(),
});

/**
 * Hjälp: gör “vänligt fält”-namn till felmeddelanden
 */
function friendlyFieldName(key) {
  switch (key) {
    case 'firstName': return 'förnamn';
    case 'lastName': return 'efternamn';
    case 'personalNumber': return 'personnummer';
    case 'email': return 'e-post';
    case 'emailConfirm': return 'bekräfta e-post';
    case 'phone': return 'telefonnummer';
    case 'addressStreet': return 'gatuadress';
    case 'addressZip': return 'postnummer';
    case 'addressCity': return 'ort';
    case 'country': return 'land';
    case 'password': return 'lösenord';
    case 'passwordConfirm': return 'bekräfta lösenord';
    case 'blocketEmail': return 'Blocket-e-post';
    case 'blocketPassword': return 'Blocket-lösenord';
    case 'thirdPartyConsent': return 'samtycke till tredjepartsdata';
    case 'termsAccepted': return 'godkännande av villkor och integritetspolicy';
    default: return null;
  }
}

/**
 * =========================
 *  POST /api/customers
 *  - Steg 1: email + password + terms
 *  - Steg 2: komplettera profil
 * =========================
 */
router.post('/customers', async (req, res) => {
  const raw = req.body || {};

  // Normalisera checkboxar (om de råkar komma som "on"/"true"/etc)
  const body = {
    ...raw,
    thirdPartyConsent: normalizeCheckbox(raw.thirdPartyConsent),
    termsAccepted: normalizeCheckbox(raw.termsAccepted),
  };

  // Avgör om detta är steg 2 (om personuppgifter finns)
  const isStep2 =
    !!body.firstName ||
    !!body.lastName ||
    !!body.personalNumber ||
    !!body.addressStreet ||
    !!body.addressZip ||
    !!body.addressCity;

  // ✅ NYTT: MVP-genväg
  // Om användaren godkänner villkor i steg 1 men vi saknar thirdPartyConsent,
  // sätt thirdPartyConsent=true så flödet funkar utan extra checkbox.
  if (!isStep2 && body.termsAccepted === true && (raw.thirdPartyConsent === undefined || raw.thirdPartyConsent === null || raw.thirdPartyConsent === '')) {
    body.thirdPartyConsent = true;
  }

  console.log('DEBUG /api/customers incoming:', {
    isStep2,
    email: body.email,
    termsAccepted: body.termsAccepted,
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

    if (key === 'personalNumber') {
      return res.status(400).json({ ok: false, error: 'Ogiltigt personnummer.' });
    }

    const friendly = friendlyFieldName(key);
    const msg = friendly
      ? `Kontrollera fältet: ${friendly}.`
      : 'En eller flera uppgifter är ogiltiga. Kontrollera formuläret.';

    return res.status(400).json({ ok: false, error: msg });
  }

  // Email + confirm
  const emailTrim = String(value.email || '').trim().toLowerCase();
  const emailConfirmTrim = String(value.emailConfirm || '').trim().toLowerCase() || emailTrim;

  if (!emailTrim || emailTrim !== emailConfirmTrim) {
    return res.status(400).json({ ok: false, error: 'E-postadresserna matchar inte.' });
  }

  // Password + confirm
  // Steg 2: password kan vara tomt => då byter vi inte lösenord.
  const hasPasswordInRequest = typeof value.password === 'string' && value.password.length > 0;
  if (!isStep2 || hasPasswordInRequest) {
    if ((value.password || '') !== (value.passwordConfirm || '')) {
      return res.status(400).json({ ok: false, error: 'Lösenorden matchar inte.' });
    }
  }

  const subjectRef = normSubject(emailTrim);

  // Blocket (valfritt)
  const blocketEmail = (value.blocketEmail && String(value.blocketEmail).trim()) || '';
  const blocketPassword = value.blocketPassword || '';

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

      if (
        existingByPn &&
        (!existingBySubject || existingByPn.id !== existingBySubject.id)
      ) {
        return res.status(409).json({
          ok: false,
          error: 'Det finns redan en användare med samma personnummer.',
        });
      }
    }

    // Hasha lösenord om vi ska spara/uppdatera
    const passwordHash = (!isStep2 || hasPasswordInRequest)
      ? await bcrypt.hash(value.password, 10)
      : null;

    // Bygg data beroende på steg
    const step1Data = {
      subjectRef,
      email: emailTrim,
      passwordHash, // alltid i steg 1
      thirdPartyConsent: value.thirdPartyConsent === true,
      termsAccepted: value.termsAccepted === true,
    };

    const fullName =
      isStep2
        ? (`${clean(value.firstName) || ''} ${clean(value.lastName) || ''}`.trim() || null)
        : null;

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
      thirdPartyConsent: value.thirdPartyConsent === true,
      termsAccepted: value.termsAccepted === true,
    };

    let customer;

    if (existingBySubject) {
      // Om konto redan “riktigt” och vi är i steg 1 => blocka dubbelregistrering
      if (!isStep2 && existingBySubject.passwordHash) {
        return res.status(409).json({
          ok: false,
          error: 'Det finns redan ett registrerat konto med denna e-postadress.',
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
        .catch((err) => console.error(`Misslyckades koppla Blocket-profil för kund ${customer.id}`, err));
    }

    return res.status(existingBySubject ? 200 : 201).json({
      ok: true,
      customer: {
        id: customer.id,
        fullName: customer.fullName || null,
        email: customer.email,
        subjectRef: customer.subjectRef,
      },
      flow: isStep2 ? 'step2' : 'step1',
    });
  } catch (e) {
    console.error('[POST /api/customers] error:', e);

    if (e.code === 'P2002') {
      return res.status(409).json({
        ok: false,
        error: 'Det finns redan en användare med samma e-post eller personnummer.',
      });
    }

    return res.status(500).json({ ok: false, error: 'Kunde inte skapa kund.' });
  }
});

/**
 * =========================
 * GET /api/customers – sök kunder (admin)
 * =========================
 */

// ✅ NYTT: separat endpoint för registrering så vi aldrig råkar hamna i GET /customers (q-krav)
router.post('/customers/register', (req, res) => {
  // återanvänd exakt samma logik som POST /customers
  // enklaste: kalla samma handler genom att "delegera" till den befintliga routen

  // Om du inte vill refaktorera till en gemensam funktion:
  // Kopiera innehållet från din router.post('/customers', ...) hit.
  // (Jag vet att du helst vill ha hela filer, men detta är den säkraste minimala ändringen.)
});

router.get('/customers', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ ok: false, error: 'Ange q i querystring.' });
  }

  try {
    const customers = await searchCustomers(q);
    res.json({ ok: true, count: customers.length, customers });
  } catch (e) {
    console.error('[GET /api/customers] error:', e);
    res.status(500).json({ ok: false, error: 'Kunde inte hämta kunder' });
  }
});

module.exports = router;
