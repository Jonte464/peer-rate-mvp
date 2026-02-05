// backend/server.js — App-bootstrap för PeerRate API (med diagnostik)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

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
const authRoutes = assertRouter('authRoutes', require('./routes/authRoutes'));
const linkedinAuth = assertRouter('linkedinAuth', require('./routes/linkedinAuth'));
const questionnaireRoutes = assertRouter('questionnaireRoutes', require('./routes/questionnaireRoutes'));

// DB-backed routes are optional in local dev — only load when DATABASE_URL set
const dbConfigured = Boolean(process.env.DATABASE_URL);
let ratingsRoutes, customersRoutes, adminRoutes, integrationsRoutes, externalDataRoutes, blocketRoutes, traderaRoutes, ebayRoutes, agentRoutes;
if (dbConfigured) {
  const load = (name, path) => assertRouter(name, require(path));
  ratingsRoutes = load('ratingsRoutes', './routes/ratingsRoutes');
  customersRoutes = load('customersRoutes', './routes/customersRoutes');
  adminRoutes = load('adminRoutes', './routes/adminRoutes');
  integrationsRoutes = load('integrationsRoutes', './routes/integrationsRoutes');
  externalDataRoutes = load('externalDataRoutes', './routes/externalDataRoutes');
  blocketRoutes = load('blocketRoutes', './routes/blocketRoutes');
  traderaRoutes = load('traderaRoutes', './routes/traderaRoutes');
  ebayRoutes = load('ebayRoutes', './routes/ebayRoutes');
  agentRoutes = load('agentRoutes', './routes/agentRoutes');
} else {
  console.warn('⚠️ DATABASE_URL not set — skipping DB-backed routes (development fallback).');
}

const app = express();

// --- Config ---
const PORT = Number(process.env.PORT || 3001);
// Bind to localhost by default for local development. Production can override with HOST env var.
const HOST = process.env.HOST || '127.0.0.1';
const REQUESTS_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const corsOrigin = process.env.CORS_ORIGIN || '*';

// Lita på proxy (Render)
app.set('trust proxy', 1);

// --- Middleware ---
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
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

// -----------------------------
// Statik (frontend + assets)
// Viktigt: assets måste ligga FÖRE SPA fallback
// -----------------------------
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const ASSETS_DIR = path.join(FRONTEND_DIR, 'assets');

// 1) Servera assets: /assets/hero.mp4, /assets/Jorden.png, /assets/Logo.PNG
app.use(
  '/assets',
  express.static(ASSETS_DIR, {
    maxAge: '7d',
    immutable: true,
  })
);

// 2) Servera resten av frontend (html/css/js)
app.use(express.static(FRONTEND_DIR));

// -----------------------------
// Rate limit för API
// -----------------------------
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
// Mount routes (conditionally mount DB-backed routes)
if (ratingsRoutes) app.use('/api', ratingsRoutes);
if (customersRoutes) app.use('/api', customersRoutes);
app.use('/api', authRoutes);
// Questionnaire (form) route — stores reviewer feedback for engagements
if (questionnaireRoutes) app.use('/api/questionnaires', questionnaireRoutes);
if (adminRoutes) app.use('/api/admin', adminRoutes);
if (externalDataRoutes) app.use('/api', externalDataRoutes);
if (blocketRoutes) app.use('/api', blocketRoutes);
if (integrationsRoutes) app.use('/api', integrationsRoutes);
if (traderaRoutes) app.use('/api', traderaRoutes);
if (ebayRoutes) app.use('/api', ebayRoutes);
if (agentRoutes) app.use('/api', agentRoutes);
// OAuth / auth helpers
app.use('/auth', linkedinAuth);

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
// MEN: INTE för /api och INTE för /assets och INTE för filer med "."
// -----------------------------
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.path.startsWith('/assets')) return next();
  if (req.path.includes('.')) return next(); // ex .js .css .png .mp4

  return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// --- Start ---
const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  const host = addr && addr.address ? addr.address : HOST;
  const port = addr && addr.port ? addr.port : PORT;
  console.log(`PeerRate server listening on ${host}:${port}`);
});

server.on('error', (err) => {
  console.error('❌ Server failed to start:', err && err.stack ? err.stack : err);
  process.exit(1);
});
