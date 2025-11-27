// backend/routes/authRoutes.js

const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { findCustomerBySubjectRef } = require('../storage');

const router = express.Router();

/** Login-schema */
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

/* -------------------------------------------------------
   POST /api/auth/login – används av “Lämna betyg” & “Min profil”
   ------------------------------------------------------- */
router.post('/auth/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ ok: false, error: 'Ogiltiga inloggningsuppgifter.' });
  }

  const emailTrim = String(value.email || '').trim().toLowerCase();

  try {
    const customer = await findCustomerBySubjectRef(emailTrim);
    if (!customer || !customer.passwordHash) {
      return res
        .status(401)
        .json({ ok: false, error: 'Fel e-post eller lösenord.' });
    }

    const match = await bcrypt.compare(value.password, customer.passwordHash);
    if (!match) {
      return res
        .status(401)
        .json({ ok: false, error: 'Fel e-post eller lösenord.' });
    }

    return res.status(200).json({
      ok: true,
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
      },
    });
  } catch (e) {
    console.error('[POST /api/auth/login] error:', e);
    return res
      .status(500)
      .json({ ok: false, error: 'Kunde inte logga in.' });
  }
});

module.exports = router;
