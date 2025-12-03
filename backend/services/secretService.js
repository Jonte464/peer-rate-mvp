// backend/services/secretService.js
// Enkel kryptering/dekryptering för hemligheter (t.ex. Tradera-lösenord)

const crypto = require('crypto');

// Vi använder AES-256-GCM (modernt och säkert)
const ALGO = 'aes-256-gcm';

// TRADERA_SECRET_KEY ska vara en 64-teckens hex-sträng (32 bytes)
const KEY_HEX = process.env.TRADERA_SECRET_KEY || '';

function hasValidKey() {
  return typeof KEY_HEX === 'string' && KEY_HEX.length === 64;
}

/**
 * Kryptera en hemlighet (t.ex. lösenord) till en base64-sträng.
 */
function encryptSecret(plaintext) {
  if (!plaintext) return null;
  if (!hasValidKey()) {
    console.warn(
      '[secretService] TRADERA_SECRET_KEY saknas eller har fel längd. Ingen kryptering utförs.'
    );
    return null;
  }

  const key = Buffer.from(KEY_HEX, 'hex');
  const iv = crypto.randomBytes(12); // 96-bit nonce för GCM

  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Vi packar ihop IV + TAG + DATA i samma buffer
  const payload = Buffer.concat([iv, tag, encrypted]);
  return payload.toString('base64');
}

/**
 * Dekryptera en base64-sträng tillbaka till plaintext.
 */
function decryptSecret(ciphertext) {
  if (!ciphertext) return null;
  if (!hasValidKey()) {
    console.warn(
      '[secretService] TRADERA_SECRET_KEY saknas eller har fel längd. Kan inte dekryptera.'
    );
    return null;
  }

  const key = Buffer.from(KEY_HEX, 'hex');
  const buf = Buffer.from(ciphertext, 'base64');

  // IV (12 bytes) + TAG (16 bytes) + REST = data
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = {
  encryptSecret,
  decryptSecret,
};
