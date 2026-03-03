// backend/config/cors.js
const cors = require("cors");

/**
 * Läser CORS_ORIGIN från env och tillåter EXAKT matchande Origin.
 * Ex:
 * CORS_ORIGIN=https://peerrate.ai,https://www.peerrate.ai
 */
function parseAllowedOrigins(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function createCorsMiddleware() {
  const raw = process.env.CORS_ORIGIN || "*";
  const allowed = parseAllowedOrigins(raw);

  // Om du verkligen vill köra helt öppet (dev)
  if (raw === "*" || allowed.length === 0) {
    return cors({ origin: "*" });
  }

  // Prod: returnera EN origin (den som skickas in) om den är tillåten
  return cors({
    origin: (origin, callback) => {
      // origin saknas ofta för t.ex. curl/health-checks
      if (!origin) return callback(null, true);

      if (allowed.includes(origin)) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // ändra till true först när du faktiskt använder cookies/sessions cross-site
  });
}

module.exports = {
  createCorsMiddleware,
  parseAllowedOrigins,
};