// extension/service-worker.js
// PeerRate background/service-worker
// Ansvar:
// 1) fråga backend om en deal redan är rated
// 2) cachea rated deals lokalt i extensionen
// 3) öppna rate.html endast om dealen fortfarande kan betygsättas

const API_BASE = 'https://api.peerrate.ai';
const RATE_PAGE_BASE = 'https://peerrate.ai/rate.html';

const RATED_CACHE_KEY = 'peerrate_extension_rated_cache_v1';
const RATED_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 dagar

function normalizeText(v) {
  return String(v || '').trim();
}

function normalizeLower(v) {
  return normalizeText(v).toLowerCase();
}

function normalizeSource(input) {
  const v = normalizeLower(input);

  if (v.includes('tradera')) return 'tradera';
  if (v.includes('blocket')) return 'blocket';
  if (v.includes('airbnb')) return 'airbnb';
  if (v.includes('ebay')) return 'ebay';
  if (v.includes('tiptap')) return 'tiptap';
  if (v.includes('hygglo')) return 'hygglo';
  if (v.includes('husknuten')) return 'husknuten';
  if (v.includes('facebook')) return 'facebook';

  return 'other';
}

function extractProofRef(payload) {
  return (
    normalizeText(payload?.proofRef) ||
    normalizeText(payload?.deal?.orderId) ||
    normalizeText(payload?.deal?.bookingId) ||
    normalizeText(payload?.deal?.transactionId) ||
    normalizeText(payload?.deal?.externalProofRef) ||
    normalizeText(payload?.counterparty?.orderId) ||
    normalizeText(payload?.pageUrl) ||
    ''
  );
}

function buildDealKey(payload) {
  const source = normalizeSource(payload?.source || payload?.deal?.platform || '');
  const proofRef = normalizeLower(extractProofRef(payload));
  if (!source || !proofRef) return '';
  return `${source}|${proofRef}`;
}

function encodePayload(payload) {
  const json = JSON.stringify(payload || {});
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}

function buildRateUrl(payload) {
  const pageUrl = payload?.pageUrl || '';
  const proofRef = extractProofRef(payload);
  const source = normalizeSource(payload?.source || payload?.deal?.platform || '');

  const pr = encodePayload(payload);
  return `${RATE_PAGE_BASE}?source=${encodeURIComponent(source)}&pageUrl=${encodeURIComponent(pageUrl)}&proofRef=${encodeURIComponent(proofRef)}&pr=${pr}`;
}

function storageGetLocal(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve(res?.[key]));
  });
}

function storageSetLocal(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve(true));
  });
}

async function readRatedCache() {
  try {
    const obj = (await storageGetLocal(RATED_CACHE_KEY)) || {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

async function writeRatedCache(obj) {
  try {
    await storageSetLocal({ [RATED_CACHE_KEY]: obj || {} });
  } catch {}
}

async function cleanupRatedCache() {
  const cache = await readRatedCache();
  const t = Date.now();
  let changed = false;

  for (const key of Object.keys(cache)) {
    const ts = Number(cache[key] || 0);
    if (!ts || (t - ts) > RATED_TTL_MS) {
      delete cache[key];
      changed = true;
    }
  }

  if (changed) {
    await writeRatedCache(cache);
  }

  return cache;
}

async function markDealRated(payloadOrKey) {
  const key = typeof payloadOrKey === 'string' ? payloadOrKey : buildDealKey(payloadOrKey);
  if (!key) return false;

  const cache = await cleanupRatedCache();
  cache[key] = Date.now();
  await writeRatedCache(cache);
  return true;
}

async function isDealRatedLocally(payloadOrKey) {
  const key = typeof payloadOrKey === 'string' ? payloadOrKey : buildDealKey(payloadOrKey);
  if (!key) return false;

  const cache = await cleanupRatedCache();
  return !!cache[key];
}

async function checkDealStatusWithBackend(payload) {
  const source = normalizeSource(payload?.source || payload?.deal?.platform || '');
  const proofRef = extractProofRef(payload);

  if (!proofRef) {
    return {
      ok: false,
      alreadyRated: false,
      canRate: false,
      error: 'Missing proofRef',
    };
  }

  const localHit = await isDealRatedLocally({ source, proofRef });
  if (localHit) {
    return {
      ok: true,
      alreadyRated: true,
      canRate: false,
      fromCache: true,
      source,
      proofRef,
      canonicalKey: buildDealKey({ source, proofRef }),
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/ratings/check-deal-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        proofRef,
        pageUrl: payload?.pageUrl || '',
        counterparty: payload?.counterparty || null,
        deal: payload?.deal || null,
      }),
    });

    const raw = await res.text();
    let json = null;

    try {
      json = JSON.parse(raw);
    } catch {
      json = { ok: res.ok, status: res.status, raw };
    }

    if (json?.ok && json?.alreadyRated) {
      await markDealRated({ source, proofRef });
    }

    return json || { ok: false, alreadyRated: false };
  } catch (err) {
    console.warn('[PeerRate extension] checkDealStatusWithBackend failed:', err);
    return {
      ok: false,
      alreadyRated: false,
      canRate: true,
      error: String(err?.message || err || 'Unknown error'),
    };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'checkDealStatus') {
    (async () => {
      const result = await checkDealStatusWithBackend(msg.payload || {});
      sendResponse(result);
    })();
    return true;
  }

  if (msg.type === 'openRatingForPayload') {
    (async () => {
      const payload = msg.payload || {};
      const result = await checkDealStatusWithBackend(payload);

      if (result?.ok && result?.alreadyRated) {
        sendResponse({
          ok: true,
          opened: false,
          alreadyRated: true,
          canRate: false,
        });
        return;
      }

      const url = buildRateUrl(payload);
      await chrome.tabs.create({ url });

      sendResponse({
        ok: true,
        opened: true,
        alreadyRated: false,
        canRate: true,
      });
    })();
    return true;
  }
});