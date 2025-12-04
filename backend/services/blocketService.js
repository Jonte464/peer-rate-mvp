// backend/services/blocketService.js
// ----------------------------------
// Blocket-funktionalitet är PAUSAD i denna version.
// Denna fil behåller samma API men gör ingen riktig scraping.

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { performInitialBlocketSync } = require('./blocketScraper.js');

const prisma = new PrismaClient();

const ALGO = 'aes-256-ctr';
const ENC_KEY = process.env.BLOCKET_ENCRYPTION_KEY || "00000000000000000000000000000000";

// Kryptering (behövs om en användare skulle råka fylla i Blocket-data)
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, Buffer.from(ENC_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('hex'), content: encrypted.toString('hex') });
}

// Dummy connect-funktion
async function connectBlocketProfile(customerId, username, password) {
  console.log("ℹ️ Blocket-koppling är avstängd. Sparar endast meta-data i DB.");

  const encryptedPassword = encrypt(password || "");

  const profile = await prisma.externalProfile.create({
    data: {
      customerId,
      platform: 'BLOCKET',
      username,
      encryptedPassword,
      status: 'INACTIVE'
    }
  });

  // Kör dummy sync
  await performInitialBlocketSync(profile.id);

  return profile;
}

module.exports = {
  connectBlocketProfile
};
