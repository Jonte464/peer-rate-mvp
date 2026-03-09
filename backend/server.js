// backend/server.js — App-bootstrap för PeerRate API (med diagnostik)

require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");

const { createCorsMiddleware } = require("./config/cors");

// -----------------------------
// Prisma (gör tillgänglig för äldre routes som använder global.prisma)
// -----------------------------
const dbConfigured = Boolean(process.env.DATABASE_URL);
if (dbConfigured) {
  global.prisma = new PrismaClient();
  console.log("✅ Prisma initialized on global.prisma");
} else {
  console.warn("⚠️ DATABASE_URL not set — Prisma not initialized.");
}

// -----------------------------
// Router-diagnostik (för Render)
// -----------------------------
function resolveRouter(mod) {
  if (!mod) return mod;
  if (typeof mod === "function") return mod;
  if (mod.router && typeof mod.router === "function") return mod.router;
  if (mod.default && typeof mod.default === "function") return mod.default;
  if (mod.default && mod.default.router && typeof mod.default.router === "function")
    return mod.default.router;
  return mod;
}

function assertRouter(name, mod) {
  const r = resolveRouter(mod);
  if (typeof r === "function") return r;

  const type = r === null ? "null" : typeof r;
  const keys = r && typeof r === "object" ? Object.keys(r) : [];
  console.error(`❌ ROUTE EXPORT ERROR: ${name} is not an Express router (function).`);
  console.error(`   typeof = ${type}`);
  console.error(`   keys   = ${JSON.stringify(keys)}`);
  console.error(`   hint   = File should end with: module.exports = router;`);
  process.exit(1);
}

// ---- Ladda routes (med diagnostik)
const authRoutes = assertRouter("authRoutes", require("./routes/authRoutes"));
const linkedinAuth = assertRouter("linkedinAuth", require("./routes/linkedinAuth"));

let ratingsRoutes,
  ratingChecksRoutes,
  customersRoutes,
  adminRoutes,
  integrationsRoutes,
  externalDataRoutes,
  blocketRoutes,
  traderaRoutes,
  ebayRoutes,
  agentRoutes,
  onboardingRoutes,
  meRoutes;

if (dbConfigured) {
  const load = (name, p) => assertRouter(name, require(p));

  ratingsRoutes = load("ratingsRoutes", "./routes/ratingsRoutes");
  ratingChecksRoutes = load("ratingChecksRoutes", "./routes/ratingChecksRoutes");
  customersRoutes = load("customersRoutes", "./routes/customersRoutes");
  adminRoutes = load("adminRoutes", "./routes/adminRoutes");
  integrationsRoutes = load("integrationsRoutes", "./routes/integrationsRoutes");
  externalDataRoutes = load("externalDataRoutes", "./routes/externalDataRoutes");
  blocketRoutes = load("blocketRoutes", "./routes/blocketRoutes");
  traderaRoutes = load("traderaRoutes", "./routes/traderaRoutes");
  ebayRoutes = load("ebayRoutes", "./routes/ebayRoutes");
  agentRoutes = load("agentRoutes", "./routes/agentRoutes");
  onboardingRoutes = load("onboardingRoutes", "./routes/onboardingRoutes");
  meRoutes = load("meRoutes", "./routes/meRoutes");
} else {
  console.warn("⚠️ DATABASE_URL not set — skipping DB-backed routes (development fallback).");
}

const app = express();

// --- Config ---
const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";
const REQUESTS_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const corsOriginRaw = process.env.CORS_ORIGIN || "*";

app.set("trust proxy", 1);

// --- Middleware ---
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
  })
);
app.use(compression());

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://www.peerrate.ai https://peerrate.ai https://editor.wix.com https://www.wix.com"
  );
  res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.peerrate.ai");
  next();
});

app.use(createCorsMiddleware());

// -----------------------------
// Statik (frontend + assets)
// -----------------------------
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const ASSETS_DIR = path.join(FRONTEND_DIR, "assets");

app.use(
  "/assets",
  express.static(ASSETS_DIR, {
    maxAge: "7d",
    immutable: true,
  })
);

app.use(express.static(FRONTEND_DIR));

// -----------------------------
// Rate limit för API
// -----------------------------
app.use(
  "/api/",
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
if (ratingsRoutes) app.use("/api", ratingsRoutes);
if (ratingChecksRoutes) app.use("/api", ratingChecksRoutes);
if (customersRoutes) app.use("/api", customersRoutes);
if (onboardingRoutes) app.use("/api", onboardingRoutes);
if (meRoutes) app.use("/api", meRoutes);

app.use("/api", authRoutes);

if (adminRoutes) app.use("/api/admin", adminRoutes);

if (externalDataRoutes) app.use("/api", externalDataRoutes);
if (blocketRoutes) app.use("/api", blocketRoutes);
if (integrationsRoutes) app.use("/api", integrationsRoutes);
if (traderaRoutes) app.use("/api", traderaRoutes);
if (ebayRoutes) app.use("/api", ebayRoutes);
if (agentRoutes) app.use("/api", agentRoutes);

app.use("/auth", linkedinAuth);

// -----------------------------
// Health
// -----------------------------
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
    port: PORT,
    host: HOST,
    corsOrigin: corsOriginRaw,
    uptimeSec: Math.round(process.uptime()),
    dbConfigured,
    prismaReady: Boolean(global.prisma),
  });
});

// -----------------------------
// Error handler
// -----------------------------
app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled server error:", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

// -----------------------------
// SPA fallback
// -----------------------------
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (req.path.startsWith("/assets")) return next();
  if (req.path.includes(".")) return next();

  return res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// --- Start ---
const server = app.listen(PORT, HOST, () => {
  console.log(`PeerRate server listening on http://${HOST}:${PORT}`);
  console.log(`[env] NODE_ENV=${process.env.NODE_ENV || "development"}  dbConfigured=${dbConfigured}`);
});

server.on("error", (err) => {
  console.error("❌ Server failed to start:", err && err.stack ? err.stack : err);
  process.exit(1);
});