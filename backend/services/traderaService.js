// backend/services/traderaService.js
//
// Säker prod-version utan Playwright-scraper.
// - Används för att koppla kund -> Tradera-profil (ExternalProfile).
// - /api/tradera/summary + /api/tradera/mock-orders fortsätter fungera.
// - /api/tradera/sync-now gör INGEN riktig scraping, bara en "placeholder".

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Hämta kund (Customer) via e-post/subjectRef.
 */
async function findCustomerByEmailOrSubject(emailOrSubject) {
  if (!emailOrSubject) return null;
  const q = String(emailOrSubject).trim().toLowerCase();
  if (!q) return null;

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ email: q }, { subjectRef: q }],
    },
  });

  return customer;
}

/**
 * Hämta Tradera-profil (ExternalProfile) för en given kund.
 */
async function findTraderaProfileForCustomer(customerId) {
  if (!customerId) return null;

  const profile = await prisma.externalProfile.findFirst({
    where: {
      customerId,
      platform: 'TRADERA',
    },
  });

  return profile;
}

/**
 * "Synka" Tradera-data för en given profil.
 *
 * PROD-VERSION:
 *  - Ingen riktig scraping körs här.
 *  - Vi uppdaterar bara lastSyncedAt och returnerar en tydlig status.
 */
async function syncTraderaForProfile(profile) {
  if (!profile) {
    throw new Error('TraderaService: profil saknas');
  }

  // Vi loggar bara att någon försökt synka.
  console.log(
    '[TraderaService] syncTraderaForProfile kallad för profil',
    profile.id,
    '- automatisk scraping är avstängd i produktion.'
  );

  // Uppdatera lastSyncedAt så vi ser att något har hänt
  await prisma.externalProfile.update({
    where: { id: profile.id },
    data: { lastSyncedAt: new Date() },
  });

  return {
    ok: false,
    profileId: profile.id,
    created: 0,
    updated: 0,
    totalScraped: 0,
    message: 'Automatisk Tradera-import är inte aktiverad i produktion ännu.',
  };
}

/**
 * Publik funktion: "synka" Tradera för kund via e-post/subjectRef.
 * Används av /api/tradera/sync-now.
 */
async function syncTraderaForEmail(emailOrSubject) {
  const customer = await findCustomerByEmailOrSubject(emailOrSubject);
  if (!customer) {
    throw new Error('TraderaService: kunde inte hitta kund för given e-post.');
  }

  const profile = await findTraderaProfileForCustomer(customer.id);
  if (!profile) {
    throw new Error(
      'TraderaService: ingen Tradera-profil är kopplad till denna kund.'
    );
  }

  return syncTraderaForProfile(profile);
}

module.exports = {
  findCustomerByEmailOrSubject,
  findTraderaProfileForCustomer,
  syncTraderaForProfile,
  syncTraderaForEmail,
};
