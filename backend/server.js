require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const { PrismaClient } = require('@prisma/client');
const { connectBlocketProfile } = require('./services/blocketService');

// Routes
const ratingsRoutes = require('./routes/ratingsRoutes');
const customersRoutes = require('./routes/customersRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const prisma = new PrismaClient();

// Endast det vi behöver härifrån storage
const { findCustomerBySubjectRef } = require('./storage');

// Hjälpfunktioner
const {
  extractAddressPartsFromCustomer,
  buildExternalDataResponse,
} = require('./helpers');

// PAP API service (adressverifiering)
const { lookupAddressWithPapApi } = require('./services/papApiService');

const app = express();

// --- Config ---
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
const REQUESTS_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);

// Lita på proxy (Render/Vercel/NGINX m.m.)
app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json({ limit: '200kb' }));
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
  })
);
app.use(compression());

// Tillåt inbäddning i Wix (iframe)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://www.peerrate.ai https://peerrate.ai https://editor.wix.com https://www.wix.com"
  );
  res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.peerrate.ai');
  next();
});

// CORS
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// Statik (frontend)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Rate limit för API
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: REQUESTS_PER_MIN,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Koppla in routes
app.use('/api', ratingsRoutes);
app.use('/api', customersRoutes);
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);

// --- Health ---
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    port: PORT,
    corsOrigin,
    uptimeSec: Math.round(process.uptime()),
  });
});

// Enkel auth-middleware (för framtida bruk)
function requireAuth(req, res, next) {
  if (req.user && req.user.id) return next();
  return res.status(401).json({ ok: false, error: 'Ej inloggad' });
}

/**
 * GET /api/customers/external-data
 * Hämtar ENDAST extern data. Ingen fallback till profilen.
 */
app.get('/api/customers/external-data', async (req, res) => {
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
   Blocket-koppling (extern)
   ------------------------------------------------------- */
app.post('/api/external/blocket/connect', async (req, res) => {
  try {
    const { customerId, username, password } = req.body;

    if (!customerId || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const profile = await connectBlocketProfile(customerId, username, password);

    res.json({
      success: true,
      profile,
    });
  } catch (err) {
    console.error('Blocket connect error:', err);
    res.status(500).json({ error: 'Failed to connect Blocket profile' });
  }
});

/* -------------------------------------------------------
   Hämta extern data (DEMO) baserat på profil
   ------------------------------------------------------- */
app.get('/api/profile/external-demo', async (req, res) => {
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

// --- Fallback: SPA --- (lägg allra sist)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate MVP running on ${HOST}:${PORT}`);
});
