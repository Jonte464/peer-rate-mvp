// backend/services/blocketService.js
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { performInitialBlocketSync } = require('./blocketScraper.js');

const prisma = new PrismaClient();

const ALGO = 'aes-256-ctr';
const ENC_KEY = process.env.BLOCKET_ENCRYPTION_KEY; // Måste vara exakt 32 tecken!

if (!ENC_KEY || ENC_KEY.length !== 32) {
  console.warn(
    '⚠️ BLOCKET_ENCRYPTION_KEY saknas eller har fel längd (måste vara exakt 32 tecken).'
  );
}

/**
 * Kryptera Blocket-lösenord säkert
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16); // unik IV per lösenord
  const cipher = crypto.createCipheriv(ALGO, Buffer.from(ENC_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

  return JSON.stringify({
    iv: iv.toString('hex'),
    content: encrypted.toString('hex'),
  });
}

/**
 * Skapa Blocket-profil i DB + trigga första synk
 */
async function connectBlocketProfile(customerId, username, password) {
  const encryptedPassword = encrypt(password);

  const profile = await prisma.externalProfile.create({
    data: {
      customerId,
      platform: 'BLOCKET',
      username,
      encryptedPassword,
      status: 'ACTIVE',
    },
  });

  // Kör initial sync (login + cookies + listings)
  try {
    await performInitialBlocketSync(profile.id);
  } catch (err) {
    console.error('Initial Blocket sync failed:', err);
  }

  return profile;
}

module.exports = {
  connectBlocketProfile,
};
