// backend/server.js — App-bootstrap för PeerRate API (med diagnostik)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

// -----------------------------
// Router-diagnostik (för Render)
// -----------------------------
function resolveRouter(mod) {
  if (!mod) return mod;

  // Express Router är en function
  if (typeof mod === 'function') return mod;

  // Vanliga varianter
  if (mod.router && typeof mod.router === 'function') return mod.router;
  if (mod.default && typeof mod.default === 'function') return mod.default;
  if (mod.default && mod.default.router && typeof mod.default.router === 'function')
    return mod.default.router;

  return mod; // fallback
}

function assertRouter(name, mod) {
  const r = resolveRouter(mod);
  if (typeof r === 'function') return r;

  const type = r === null ? 'null' : typeof r;
  const keys = r && typeof r === 'object' ? Object.keys(r) : [];
  console.error(`❌ ROUTE EXPORT ERROR: ${name} is not an Express router (function).`);
  console.error(`   typeof = ${type}`);
  console.error(`   keys   = ${JSON.stringify(keys)}`);
  console.error(`   hint   = File should end with: module.exports = router;`);
  process.exit(1);
}

// ---- Ladda routes (med diagnostik)
const ratingsRoutes = assertRouter('ratingsRoutes', require('./routes/ratingsRoutes'));
const customersRoutes = assertRouter('customersRoutes', require('./routes/customersRoutes'));
const authRoutes = assertRouter('authRoutes', require('./routes/authRoutes'));
const adminRoutes = assertRouter('adminRoutes', require('./routes/adminRoutes'));
const integrationsRoutes = assertRouter('integrationsRoutes', require('./routes/integrationsRoutes'));
const externalDataRoutes = assertRouter('externalDataRoutes', require('./routes/externalDataRoutes'));
const blocketRoutes = assertRouter('blocketRoutes', require('./routes/blocketRoutes'));
const traderaRoutes = assertRouter('traderaRoutes', require('./routes/traderaRoutes'));

const app = express();

// --- Config ---
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
const REQUESTS_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const corsOrigin = process.env.CORS_ORIGIN || '*';

// Lita på proxy (Render)
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

// -----------------------------
// Routes
// -----------------------------
app.use('/api', ratingsRoutes);
app.use('/api', customersRoutes);
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', externalDataRoutes);
app.use('/api', blocketRoutes);
app.use('/api', integrationsRoutes);
app.use('/api', traderaRoutes);

// -----------------------------
// Health
// -----------------------------
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

// -----------------------------
// Error handler (viktigt: före SPA fallback)
// -----------------------------
app.use((err, _req, res, _next) => {
  console.error('❌ Unhandled server error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// -----------------------------
// SPA fallback (lägg ALLRA SIST)
// -----------------------------
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(`PeerRate PROD running on ${HOST}:${PORT}`);
});
