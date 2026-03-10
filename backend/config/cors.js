// backend/config/cors.js
const cors = require("cors");

/**
 * Läser CORS_ORIGIN från env och tillåter EXAKT matchande Origin.
 * Ex:
 * CORS_ORIGIN=https://peerrate.ai,https://www.peerrate.ai
 *
 * Viktigt:
 * - Tillåter även chrome-extension:// origins så att PeerRate-extensionen
 *   kan anropa api.peerrate.ai direkt.
 */
function parseAllowedOrigins(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isChromeExtensionOrigin(origin) {
  return /^chrome-extension:\/\/[a-z]{32}$/i.test(String(origin || "").trim());
}

function createCorsMiddleware() {
  const raw = process.env.CORS_ORIGIN || "*";
  const allowed = parseAllowedOrigins(raw);

  // Om du verkligen vill köra helt öppet (dev)
  if (raw === "*" || allowed.length === 0) {
    return cors({
      origin: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-user-email"],
      credentials: false,
    });
  }

  return cors({
    origin: (origin, callback) => {
      // origin saknas ofta för curl, health-checks och vissa server-to-server-anrop
      if (!origin) return callback(null, true);

      if (allowed.includes(origin)) return callback(null, true);

      // Tillåt Chrome extension
      if (isChromeExtensionOrigin(origin)) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-email"],
    credentials: false,
  });
}

module.exports = {
  createCorsMiddleware,
  parseAllowedOrigins,
};