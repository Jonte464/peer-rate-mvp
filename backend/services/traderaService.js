// backend/services/traderaService.js
//
// Hanterar Tradera-profiler (ExternalProfile) och import av ordrar
// + (valfritt) scraping via Playwright.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { decryptSecret } = require('./secretService');
const { fetchTraderaOrdersViaScraping } = require('./traderaImporter');

// 💡 Ny logik: scraping kan köras i produktion om TRADERA_SCRAPING_ENABLED = "true"
const ENABLE_SCRAPING =
  String(process.env.TRADERA_SCRAPING_ENABLED || '').toLowerCase() === 'true';

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
 * Synka Tradera-data för en given profil (ExternalProfile).
 * PROD/DEV: styrs av env-variabeln TRADERA_SCRAPING_ENABLED.
 */
async function syncTraderaForProfile(profile) {
  if (!profile) {
    throw new Error('TraderaService: profil saknas');
  }

  // 🔒 Blockera scraping om inte env-flaggan är satt
  if (!ENABLE_SCRAPING) {
    return {
      ok: false,
      profileId: profile.id,
      created: 0,
      updated: 0,
      totalScraped: 0,
      message:
        'Automatisk Tradera-import är inte aktiverad. Sätt TRADERA_SCRAPING_ENABLED=true för att slå på.',
    };
  }

  if (!profile.username) {
    throw new Error('TraderaService: profil saknar username');
  }

  if (!profile.encryptedPassword) {
    throw new Error(
      'TraderaService: inget sparat Tradera-lösenord. Kan inte göra automatisk scraping.'
    );
  }

  const password = decryptSecret(profile.encryptedPassword);
  if (!password) {
    throw new Error(
      'TraderaService: kunde inte dekryptera Tradera-lösenordet.'
    );
  }

  // Hämta affärer via scrapern (MVP: 1 sida per vy)
  const orders = await fetchTraderaOrdersViaScraping({
    username: profile.username,
    password,
    maxPages: 1,
  });

  if (!Array.isArray(orders) || orders.length === 0) {
    // Uppdatera lastSyncedAt ändå, så vi vet att vi försökt
    await prisma.externalProfile.update({
      where: { id: profile.id },
      data: { lastSyncedAt: new Date() },
    });

    return {
      ok: true,
      profileId: profile.id,
      created: 0,
      updated: 0,
      totalScraped: 0,
    };
  }

  let created = 0;
  let updated = 0;

  for (const o of orders) {
    if (!o) continue;

    const traderaOrderId = o.traderaId || o.traderaOrderId || null;
    if (!traderaOrderId) {
      // Hoppa över rader som saknar något slags ID
      continue;
    }

    const title = o.title || '(utan titel)';

    // Försök parsa amount
    let amount = null;
    if (typeof o.amount === 'number') {
      amount = o.amount;
    } else if (typeof o.amount === 'string') {
      const n = Number(o.amount.replace(/\s+/g, ''));
      amount = Number.isNaN(n) ? null : n;
    }

    const currency = (o.currency || 'SEK').toUpperCase();

    // Role: BUYER / SELLER
    const roleRaw = (o.role || '').toUpperCase();
    const role = roleRaw === 'BUYER' ? 'BUYER' : 'SELLER';

    // Datum
    let completedAt = null;
    if (o.completedAt) {
      const d = new Date(o.completedAt);
      if (!Number.isNaN(d.getTime())) {
        completedAt = d;
      }
    }

    const counterpartyAlias = o.counterpartyAlias || null;
    const counterpartyEmail = o.counterpartyEmail || null;

    // Finns det redan en order med detta traderaOrderId + profil?
    const existing = await prisma.traderaOrder.findFirst({
      where: {
        externalProfileId: profile.id,
        traderaOrderId,
      },
    });

    if (existing) {
      await prisma.traderaOrder.update({
        where: { id: existing.id },
        data: {
          title,
          amount,
          currency,
          role,
          counterpartyAlias,
          counterpartyEmail,
          completedAt,
          rawJson: o,
        },
      });
      updated += 1;
    } else {
      await prisma.traderaOrder.create({
        data: {
          externalProfileId: profile.id,
          traderaOrderId,
          traderaItemId: o.traderaItemId || null,
          title,
          amount,
          currency,
          role,
          counterpartyAlias,
          counterpartyEmail,
          completedAt,
          rawJson: o,
        },
      });
      created += 1;
    }
  }

  // Uppdatera lastSyncedAt
  await prisma.externalProfile.update({
    where: { id: profile.id },
    data: { lastSyncedAt: new Date() },
  });

  return {
    ok: true,
    profileId: profile.id,
    created,
    updated,
    totalScraped: orders.length,
  };
}

/**
 * Publik funktion: synka Tradera för kund via e-post/subjectRef.
 * Användbar i routes, t.ex. /api/tradera/sync-now.
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

/**
 * Ny funktion: importera ordrar "utifrån" (t.ex. scraper eller exporterad fil)
 * utan att köra scraping i produktion.
 */
async function importTraderaOrdersForEmail(emailOrSubject, orders) {
  if (!emailOrSubject) {
    throw new Error('Tradera import: e-post saknas');
  }

  if (!Array.isArray(orders) || orders.length === 0) {
    throw new Error('Tradera import: inga ordrar att importera');
  }

  const customer = await findCustomerByEmailOrSubject(emailOrSubject);
  if (!customer) {
    throw new Error('Tradera import: kunde inte hitta kund');
  }

  // Se om det redan finns en Tradera-profil, annars skapa en enkel.
  let profile = await findTraderaProfileForCustomer(customer.id);
  if (!profile) {
    profile = await prisma.externalProfile.create({
      data: {
        customerId: customer.id,
        platform: 'TRADERA',
        username: null,
        status: 'ACTIVE',
      },
    });
  }

  let created = 0;
  let updated = 0;

  for (const raw of orders) {
    if (!raw) continue;

    const traderaOrderId = String(
      raw.traderaOrderId || raw.traderaId || raw.orderId || ''
    ).trim();
    if (!traderaOrderId) continue;

    const title = raw.title || '(utan titel)';

    // Belopp
    let amount = null;
    if (typeof raw.amount === 'number') {
      amount = raw.amount;
    } else if (typeof raw.amount === 'string') {
      const n = Number(raw.amount.replace(/\s+/g, '').replace(',', '.'));
      amount = Number.isNaN(n) ? null : n;
    }

    const currency = (raw.currency || 'SEK').toUpperCase();

    // BUYER / SELLER (defaulta gärna till BUYER om oklart)
    const roleRaw = String(raw.role || '').toUpperCase();
    const role = roleRaw === 'SELLER' ? 'SELLER' : 'BUYER';

    // Datum
    let completedAt = null;
    if (raw.completedAt) {
      const d = new Date(raw.completedAt);
      if (!Number.isNaN(d.getTime())) {
        completedAt = d;
      }
    }

    const counterpartyAlias = raw.counterpartyAlias || null;
    const counterpartyEmail = raw.counterpartyEmail || null;

    // 🔁 Samma mönster som gamla koden: hitta befintlig rad och uppdatera,
    // annars skapa ny. Ingen Prisma-upsert med felaktigt unique-key.
    const existing = await prisma.traderaOrder.findFirst({
      where: {
        externalProfileId: profile.id,
        traderaOrderId,
      },
    });

    if (existing) {
      await prisma.traderaOrder.update({
        where: { id: existing.id },
        data: {
          title,
          amount,
          currency,
          role,
          counterpartyAlias,
          counterpartyEmail,
          completedAt,
          rawJson: raw,
        },
      });
      updated += 1;
    } else {
      await prisma.traderaOrder.create({
        data: {
          externalProfileId: profile.id,
          traderaOrderId,
          traderaItemId: raw.traderaItemId || raw.itemId || null,
          title,
          amount,
          currency,
          role,
          counterpartyAlias,
          counterpartyEmail,
          completedAt,
          rawJson: raw,
        },
      });
      created += 1;
    }
  }

  // Uppdatera senast synkad
  await prisma.externalProfile.update({
    where: { id: profile.id },
    data: { lastSyncedAt: new Date() },
  });

  return {
    ok: true,
    profileId: profile.id,
    created,
    updated,
    totalImported: created + updated,
  };
}

module.exports = {
  findCustomerByEmailOrSubject,
  findTraderaProfileForCustomer,
  syncTraderaForProfile,
  syncTraderaForEmail,
  importTraderaOrdersForEmail,
};
