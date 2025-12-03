// backend/crypto.js
// Enkel helper för att kryptera/dekryptera hemligheter (t.ex. externa lösenord)
// med en serverhemlighet i APP_ENCRYPTION_KEY (i .env / Render).

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

// Härder/”sträcker” vi nyckeln från APP_ENCRYPTION_KEY till 32 bytes
function getKey() {
  const secret = process.env.APP_ENCRYPTION_KEY || '';
  if (!secret) {
    throw new Error(
      'APP_ENCRYPTION_KEY saknas. Sätt en stark hemlighet i .env/Render innan du använder kryptering.'
    );
  }
  // 32 bytes nyckel via SHA-256 på din hemlighet
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Krypterar en sträng och returnerar en Base64-sträng.
 * Format: base64(iv(12) + tag(16) + cipherText)
 */
function encryptSecret(plainText) {
  if (plainText == null) return null;
  const key = getKey();

  const iv = crypto.randomBytes(12); // rekommenderad längd för GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const enc = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Packa ihop iv + tag + cipherText
  const payload = Buffer.concat([iv, tag, enc]);
  return payload.toString('base64');
}

/**
 * Dekrypterar en Base64-sträng (skapad av encryptSecret) och returnerar klartext.
 */
function decryptSecret(b64) {
  if (!b64) return null;
  const key = getKey();

  const payload = Buffer.from(b64, 'base64');
  if (payload.length < 12 + 16 + 1) {
    throw new Error('Krypterad sträng är för kort eller korrupt');
  }

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const cipherText = payload.subarray(28);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = {
  encryptSecret,
  decryptSecret,
};
