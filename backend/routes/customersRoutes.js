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

/** Skapa kund – validering */
const createCustomerSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  personalNumber: Joi.string()
    .custom((value, helpers) => {
      if (!isValidPersonalNumber(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required(),
  email: Joi.string().email().required(),
  emailConfirm: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
  passwordConfirm: Joi.string().min(8).max(100).required(),
  phone: Joi.string()
    .pattern(/^[0-9+\s\-()]*$/)
    .allow('', null),
  addressStreet: Joi.string().max(200).allow('', null),
  addressZip: Joi.string().max(20).allow('', null),
  addressCity: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).allow('', null),

  // NYTT: Blocket-fält (valfria)
  blocketEmail: Joi.string().email().allow('', null),
  blocketPassword: Joi.string().min(1).max(200).allow('', null),

  // Samtycken – måste vara TRUE
  thirdPartyConsent: Joi.boolean().valid(true).required(),
  termsAccepted: Joi.boolean().valid(true).required(),
});

/* -------------------------------------------------------
   POST /api/customers – registrera kund
   ------------------------------------------------------- */
router.post('/customers', async (req, res) => {
  // Normalisera checkboxar innan validering
  const raw = req.body || {};
  console.log('DEBUG raw req.body (incoming):', JSON.stringify(raw));

  const body = {
    ...raw,
    thirdPartyConsent: normalizeCheckbox(raw.thirdPartyConsent),
    termsAccepted: normalizeCheckbox(raw.termsAccepted),
  };

  console.log(
    'DEBUG backend /api/customers body:',
    'thirdPartyConsent =',
    body.thirdPartyConsent,
    'termsAccepted =',
    body.termsAccepted
  );

  const { error, value } = createCustomerSchema.validate(body);

  if (error) {
    const firstDetail = error.details && error.details[0];
    const key =
      (firstDetail && firstDetail.context && firstDetail.context.key) ||
      (firstDetail && firstDetail.path && firstDetail.path[0]);

    let friendlyField = null;
    switch (key) {
      case 'firstName':
        friendlyField = 'förnamn';
        break;
      case 'lastName':
        friendlyField = 'efternamn';
        break;
      case 'personalNumber':
        friendlyField = 'personnummer';
        break;
      case 'email':
        friendlyField = 'e-post';
        break;
      case 'emailConfirm':
        friendlyField = 'bekräfta e-post';
        break;
      case 'phone':
        friendlyField = 'telefonnummer';
        break;
      case 'addressStreet':
        friendlyField = 'gatuadress';
        break;
      case 'addressZip':
        friendlyField = 'postnummer';
        break;
      case 'addressCity':
        friendlyField = 'ort';
        break;
      case 'country':
        friendlyField = 'land';
        break;
      case 'password':
        friendlyField = 'lösenord';
        break;
      case 'passwordConfirm':
        friendlyField = 'bekräfta lösenord';
        break;
      case 'blocketEmail':
        friendlyField = 'Blocket-e-post';
        break;
      case 'blocketPassword':
        friendlyField = 'Blocket-lösenord';
        break;
      case 'thirdPartyConsent':
        friendlyField = 'samtycke till tredjepartsdata';
        break;
      case 'termsAccepted':
        friendlyField = 'godkännande av villkor och integritetspolicy';
        break;
      default:
        friendlyField = null;
    }

    // Specialfall: ogiltigt personnummer
    if (key === 'personalNumber') {
      return res
        .status(400)
        .json({ ok: false, error: 'Ogiltigt personnummer.' });
    }

    const msg = friendlyField
      ? `Kontrollera fältet: ${friendlyField}.`
      : 'En eller flera uppgifter är ogiltiga. Kontrollera formuläret.';

    return res.status(400).json({ ok: false, error: msg });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();
  const emailConfirmTrim = String(value.emailConfirm || '')
    .trim()
    .toLowerCase();

  if (!emailTrim || emailTrim !== emailConfirmTrim) {
    return res
      .status(400)
      .json({ ok: false, error: 'E-postadresserna matchar inte.' });
  }

  if (value.password !== value.passwordConfirm) {
    return res
      .status(400)
      .json({ ok: false, error: 'Lösenorden matchar inte.' });
  }

  const subjectRef = normSubject(emailTrim);
  const personalNumberClean = clean(value.personalNumber);

  // Här vet vi: thirdPartyConsent = true, termsAccepted = true (validerat av Joi)
  const fullName =
    `${clean(value.firstName) || ''} ${clean(value.lastName) || ''}`.trim() ||
    null;
  const passwordHash = await bcrypt.hash(value.password, 10);

  // NYTT: plocka ut Blocket-fält (valfria)
  const blocketEmail =
    (value.blocketEmail && String(value.blocketEmail).trim()) || '';
  const blocketPassword = value.blocketPassword || '';

  try {
    // 1) Finns det redan en kund med denna subjectRef (dvs e-post som subject)?
    const existingBySubject = await prisma.customer.findUnique({
      where: { subjectRef },
    });

    // 2) Finns det någon annan kund med samma personnummer?
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

    let customer;

    if (existingBySubject) {
      // Om den redan har ett lösenord: det är ett "riktigt" konto -> stoppa
      if (existingBySubject.passwordHash) {
        return res.status(409).json({
          ok: false,
          error:
            'Det finns redan ett registrerat konto med denna e-postadress.',
        });
      }

      // Annars: uppgradera "skugganvändaren" (skapad via tidigare betyg)
      customer = await prisma.customer.update({
        where: { id: existingBySubject.id },
        data: {
          subjectRef, // oförändrat egentligen
          fullName,
          personalNumber: personalNumberClean,
          email: emailTrim,
          phone: normalizePhone(value.phone),
          addressStreet: clean(value.addressStreet),
          addressZip: clean(value.addressZip),
          addressCity: clean(value.addressCity),
          country: clean(value.country),
          passwordHash,
          thirdPartyConsent: value.thirdPartyConsent === true,
          termsAccepted: value.termsAccepted === true,
        },
      });
    } else {
      // Ingen kund alls – skapa ny
      customer = await prisma.customer.create({
        data: {
          subjectRef,
          fullName,
          personalNumber: personalNumberClean,
          email: emailTrim,
          phone: normalizePhone(value.phone),
          addressStreet: clean(value.addressStreet),
          addressZip: clean(value.addressZip),
          addressCity: clean(value.addressCity),
          country: clean(value.country),
          passwordHash,
          thirdPartyConsent: value.thirdPartyConsent === true,
          termsAccepted: value.termsAccepted === true,
        },
      });
    }

    // Starta Blocket-koppling i bakgrunden om båda fälten är ifyllda
    if (blocketEmail && blocketPassword) {
      connectBlocketProfile(customer.id, blocketEmail, blocketPassword)
        .then(() => {
          console.log(
            `Blocket-profil kopplad för kund ${customer.id} (${blocketEmail})`
          );
        })
        .catch((err) => {
          console.error(
            `Misslyckades att koppla Blocket-profil för kund ${customer.id}`,
            err
          );
        });
    }

    return res.status(201).json({
      ok: true,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        subjectRef: customer.subjectRef,
      },
    });
  } catch (e) {
    console.error('[POST /api/customers] error:', e);

    if (e.code === 'P2002') {
      // Fallback om någon unik-constraint ändå smäller
      return res.status(409).json({
        ok: false,
        error:
          'Det finns redan en användare med samma e-post eller personnummer.',
      });
    }

    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte skapa kund.' });
  }
});

/* -------------------------------------------------------
   GET /api/customers – sök kunder
   ------------------------------------------------------- */
router.get('/customers', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ange q i querystring.' });
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
