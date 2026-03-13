// extension/service-worker.js
// PeerRate background/service-worker
// Förenklad roll:
// - kontrollera med backend om affären får betygsättas
// - hålla lokal cache för redan betygsatta affärer
// - ta emot markDealRated från rate-sidan
//
// Bygger INTE längre rate-url och öppnar INTE längre rate.html.

const API_BASE = 'https://api.peerrate.ai';

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

function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);

    fetch(url, options)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function checkDealStatusWithBackend(payload) {
  const source = normalizeSource(payload?.source || payload?.deal?.platform || '');
  const proofRef = extractProofRef(payload);

  if (!source || !proofRef) {
    return {
      ok: false,
      alreadyRated: false,
      canRate: false,
      error: 'Missing source or proofRef',
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
    const res = await fetchWithTimeout(
      `${API_BASE}/api/ratings/check-deal-status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'extension',
          source,
          proofRef,
          pageUrl: payload?.pageUrl || '',
          counterparty: payload?.counterparty || null,
          deal: payload?.deal || null,
        }),
      },
      6000
    );

    const raw = await res.text();

    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = { ok: false, status: res.status, raw };
    }

    if (!json || json.ok !== true) {
      return {
        ok: false,
        alreadyRated: false,
        canRate: false,
        status: res.status,
        error: json?.error || 'Backend check failed',
        raw: json?.raw || raw || null,
      };
    }

    if (json.alreadyRated === true) {
      await markDealRated({ source, proofRef });
      return {
        ...json,
        ok: true,
        alreadyRated: true,
        canRate: false,
      };
    }

    if (json.canRate === true) {
      return {
        ...json,
        ok: true,
        alreadyRated: false,
        canRate: true,
      };
    }

    return {
      ok: true,
      alreadyRated: false,
      canRate: false,
      error: 'Backend did not allow rating',
    };
  } catch (err) {
    console.warn('[PeerRate extension] checkDealStatusWithBackend failed:', err);
    return {
      ok: false,
      alreadyRated: false,
      canRate: false,
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

  if (msg.type === 'markDealRatedFromPage') {
    (async () => {
      const payload = msg.payload || {};
      const ok = await markDealRated(payload);

      sendResponse({
        ok: !!ok,
        stored: !!ok,
        key: buildDealKey(payload),
      });
    })();
    return true;
  }
});