// backend/server.js — App-bootstrap för PeerRate API

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

// Helper: gör så att app.use klarar både router och { router } / { default }
function pickRouter(mod) {
  if (!mod) return mod;
  if (typeof mod === 'function') return mod;         // Express Router är en function
  if (mod.default && typeof mod.default === 'function') return mod.default;
  if (mod.router && typeof mod.router === 'function') return mod.router;
  return mod; // fall back (om det fortfarande är fel -> vi ser vilken fil som är problemet)
}

// Routes (wrap med pickRouter)
const ratingsRoutes = pickRouter(require('./routes/ratingsRoutes'));
const customersRoutes = pickRouter(require('./routes/customersRoutes'));
const authRoutes = pickRouter(require('./routes/authRoutes'));
const adminRoutes = pickRouter(require('./routes/adminRoutes'));
const integrationsRoutes = pickRouter(require('./routes/integrationsRoutes'));
const externalDataRoutes = pickRouter(require('./routes/externalDataRoutes'));
const blocketRoutes = pickRouter(require('./routes/blocketRoutes'));
const traderaRoutes = pickRouter(require('./routes/traderaRoutes'));

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
app.use('/api', traderaRoutes);

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

// --- Fallback: SPA --- (lägg allra sist)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate PROD running on ${HOST}:${PORT}`);
});
