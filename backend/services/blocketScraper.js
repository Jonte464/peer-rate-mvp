// backend/services/blocketScraper.js
const { PrismaClient } = require('@prisma/client');
const playwright = require('playwright');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ALGO = 'aes-256-ctr';
const ENC_KEY = process.env.BLOCKET_ENCRYPTION_KEY;

if (!ENC_KEY || ENC_KEY.length !== 32) {
  console.warn('⚠️ BLOCKET_ENCRYPTION_KEY saknas eller har fel längd (måste vara exakt 32 tecken).');
}

/**
 * Decrypt password
 */
function decrypt(hash) {
  const { iv, content } = JSON.parse(hash);
  const decipher = crypto.createDecipheriv(
    ALGO,
    Buffer.from(ENC_KEY),
    Buffer.from(iv, 'hex')
  );
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(content, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

/**
 * Initial sync:
 *  - Login to Blocket
 *  - Store session cookies
 *  - Fetch listings
 */
async function performInitialBlocketSync(profileId) {
  const profile = await prisma.externalProfile.findUnique({
    where: { id: profileId }
  });

  if (!profile) throw new Error('Profile not found');
  if (!profile.encryptedPassword) throw new Error('No encrypted password stored');

  const password = decrypt(profile.encryptedPassword);
  const username = profile.username;

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Logging in to Blocket as', username);

  try {
    // 1. Gå till Blockets login-sida (URL kan behöva justeras)
    await page.goto('https://www.blocket.se/login', { waitUntil: 'networkidle' });

    // OBS: selectors är placeholders – vi justerar senare när vi ser riktiga DOM:en
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Vänta tills inloggningen är klar
    await page.waitForLoadState('networkidle');

    // 4. Spara cookies
    const cookies = await context.cookies();

    await prisma.externalProfile.update({
      where: { id: profileId },
      data: {
        cookiesJson: cookies,
        lastSyncedAt: new Date()
      }
    });

    console.log('✅ Saved Blocket session cookies');

    // 5. Hämta annonser
    await fetchBlocketListings(context, profileId);
  } finally {
    await browser.close();
  }
}

/**
 * Scrape "mina annonser" och spara som Listing
 */
async function fetchBlocketListings(context, profileId) {
  const page = await context.newPage();

  // URL måste ev. justeras – vi börjar här som MVP
  await page.goto('https://www.blocket.se/mitt', { waitUntil: 'networkidle' });

  // PLACEHOLDER-selectors – fintrimmas efter att vi inspekterat sidan
  const ads = await page.$$eval('.ad-card', (nodes) =>
    nodes.map((n) => ({
      id: n.getAttribute('data-item-id'),
      title: n.querySelector('.title')?.innerText || '',
      priceText: n.querySelector('.price')?.innerText || '',
      url: n.querySelector('a')?.href || ''
    }))
  );

  for (const ad of ads) {
    const numericPrice = ad.priceText
      ? parseInt(ad.priceText.replace(/\D/g, ''), 10)
      : null;

    await prisma.listing.upsert({
      where: {
        externalListingId: ad.id
      },
      update: {
        title: ad.title,
        price: numericPrice,
        lastSeenAt: new Date()
      },
      create: {
        externalProfileId: profileId,
        externalListingId: ad.id,
        title: ad.title,
        price: numericPrice,
        url: ad.url,
        status: 'ACTIVE'
      }
    });
  }

  console.log(`📦 Found ${ads.length} Blocket listings for profile ${profileId}`);
}

module.exports = {
  performInitialBlocketSync,
  fetchBlocketListings
};
