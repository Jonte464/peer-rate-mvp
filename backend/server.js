// backend/server.js — App-bootstrap för PeerRate API

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

// Routes
const ratingsRoutes = require('./routes/ratingsRoutes');
const customersRoutes = require('./routes/customersRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const integrationsRoutes = require('./routes/integrationsRoutes');
const externalDataRoutes = require('./routes/externalDataRoutes');
const blocketRoutes = require('./routes/blocketRoutes');
const traderaRoutes = require('./routes/traderaRoutes'); // 👈 NY

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

// Nya uppdelade routers
app.use('/api', externalDataRoutes);
app.use('/api', blocketRoutes);
app.use('/api', integrationsRoutes);
app.use('/api', traderaRoutes); // 👈 NY – alla /api/tradera/* hamnar här

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

// --- Fallback: SPA --- (lägg allra sist)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate PROD running on ${HOST}:${PORT}`);
});
