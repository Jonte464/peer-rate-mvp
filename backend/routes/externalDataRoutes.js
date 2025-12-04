// backend/routes/externalDataRoutes.js
// Hanterar externa data / adressverifiering

const express = require('express');
const { PrismaClient } = require('@prisma/client');

// Hjälpfunktioner
const {
  extractAddressPartsFromCustomer,
  buildExternalDataResponse,
} = require('../helpers');

// PAP API service (adressverifiering)
const { lookupAddressWithPapApi } = require('../services/papApiService');

// Endast det vi behöver härifrån storage
const { findCustomerBySubjectRef } = require('../storage');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/customers/external-data
 * Hämtar ENDAST extern data. Ingen fallback till profilen.
 *
 * OBS: router monteras under /api i server.js,
 * så här använder vi bara "/customers/external-data".
 */
router.get('/customers/external-data', async (req, res) => {
  try {
    const emailOrSubject = String(req.query.email || '').trim().toLowerCase();
    if (!emailOrSubject) {
      return res.status(400).json({ ok: false, error: 'Saknar email' });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ subjectRef: emailOrSubject }, { email: emailOrSubject }],
      },
    });

    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Kund hittades inte' });
    }

    const { street, number, zipcode, city } =
      extractAddressPartsFromCustomer(customer);

    let validatedAddress = null;
    let addressStatus = 'NO_EXTERNAL_DATA';
    let vehiclesCount = null;
    let propertiesCount = null;

    if (street || zipcode || city) {
      try {
        const externalAddress = await lookupAddressWithPapApi({
          street,
          number,
          zipcode,
          city,
        });

        if (externalAddress && typeof externalAddress === 'object') {
          const addrObj =
            externalAddress.normalizedAddress ||
            externalAddress.address ||
            externalAddress;

          const extStreet =
            addrObj.street ||
            addrObj.addressStreet ||
            addrObj.gatuadress ||
            null;
          const extZip =
            addrObj.zipcode ||
            addrObj.postalCode ||
            addrObj.postnr ||
            null;
          const extCity =
            addrObj.city ||
            addrObj.postort ||
            addrObj.addressCity ||
            null;

          const parts = [extStreet, extZip, extCity].filter(Boolean);
          if (parts.length) {
            validatedAddress = parts.join(', ');
          }

          vehiclesCount =
            externalAddress.vehiclesCount ??
            externalAddress.vehicleCount ??
            externalAddress.vehicles ??
            null;

          propertiesCount =
            externalAddress.propertiesCount ??
            externalAddress.propertyCount ??
            externalAddress.properties ??
            null;

          if (validatedAddress) {
            addressStatus = externalAddress.status
              ? String(externalAddress.status).toUpperCase()
              : externalAddress.matchStatus
              ? String(externalAddress.matchStatus).toUpperCase()
              : 'VERIFIED';
          } else {
            addressStatus = 'NO_ADDRESS_IN_RESPONSE';
          }
        }
      } catch (err) {
        console.error('PAP API lookup failed', err);
        addressStatus = 'LOOKUP_FAILED';
      }
    } else {
      addressStatus = 'NO_ADDRESS_INPUT';
    }

    const now = new Date().toISOString();

    return res.json({
      ok: true,
      vehiclesCount,
      propertiesCount,
      lastUpdated: now,
      validatedAddress,
      addressStatus,
    });
  } catch (err) {
    console.error('external-data error', err);
    return res.status(500).json({ ok: false, error: 'Internt serverfel' });
  }
});

/* -------------------------------------------------------
   Hämta extern data (DEMO) baserat på profil
   ------------------------------------------------------- */
router.get('/profile/external-demo', async (req, res) => {
  try {
    const subjectQ = String(req.query.subject || '').trim().toLowerCase();

    let customer = null;
    if (req.user && req.user.id) {
      customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
      });
    } else if (subjectQ) {
      customer = await findCustomerBySubjectRef(subjectQ);
    } else {
      return res.status(401).json({
        ok: false,
        error:
          'Ej inloggad. Ange subject som queryparameter för publik lookup.',
      });
    }

    if (!customer)
      return res.status(404).json({ ok: false, error: 'Kund saknas' });

    const { street, number, zipcode, city } =
      extractAddressPartsFromCustomer(customer);

    let externalAddress = null;
    try {
      if (street || zipcode || city) {
        externalAddress = await lookupAddressWithPapApi({
          street,
          number,
          zipcode,
          city,
        });
      }
    } catch (err) {
      console.error('PAP API lookup failed', err);
      externalAddress = null;
    }

    const payload = buildExternalDataResponse(customer, externalAddress);
    return res.json(payload);
  } catch (err) {
    console.error('External demo error', err);
    return res.status(500).json({
      ok: false,
      error: 'Serverfel vid extern hämtning',
    });
  }
});

module.exports = router;
