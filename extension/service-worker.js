// extension/service-worker.js
// PeerRate background/service-worker
// Enkel och robust transport:
// - kontrollera med backend om affären får betygsättas
// - spara full payload i extension storage
// - öppna rate.html med både tunn query + full payload i pr-param
// - rate.html kan då läsa payload direkt från URL
//
// Dubbelbetygsspärr behålls.

const API_BASE = 'https://api.peerrate.ai';
const RATE_PAGE_BASE = 'https://peerrate.ai/rate.html';

const RATED_CACHE_KEY = 'peerrate_extension_rated_cache_v1';
const RATED_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 dagar

const PENDING_PAYLOAD_KEY = 'peerrate_extension_pending_payload_v2';
const PENDING_TTL_MS = 1000 * 60 * 30; // 30 min

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

function base64EncodeUnicode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

function buildRateUrl(payload) {
  const source = normalizeSource(payload?.source || payload?.deal?.platform || '');
  const pageUrl = normalizeText(payload?.pageUrl || payload?.deal?.pageUrl || '');
  const proofRef = extractProofRef(payload);

  const qs = new URLSearchParams();
  if (source) qs.set('source', source);
  if (pageUrl) qs.set('pageUrl', pageUrl);
  if (proofRef) qs.set('proofRef', proofRef);

  try {
    const normalized = normalizePendingPayload(payload);
    if (normalized) {
      const json = JSON.stringify(normalized);
      const pr = encodeURIComponent(base64EncodeUnicode(json));
      qs.set('pr', pr);
    }
  } catch (err) {
    console.warn('[PeerRate extension] failed to attach pr payload to URL:', err);
  }

  return `${RATE_PAGE_BASE}?${qs.toString()}`;
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

function storageRemoveLocal(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, () => resolve(true));
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

function normalizePendingPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const source = normalizeSource(payload?.source || payload?.deal?.platform || '');
  const proofRef = extractProofRef(payload);
  const pageUrl = normalizeText(payload?.pageUrl || payload?.deal?.pageUrl || '');

  if (!source || !proofRef) return null;

  return {
    ...payload,
    source,
    proofRef,
    pageUrl,
    _ts: Date.now(),
    savedAt: new Date().toISOString(),
  };
}

async function writePendingPayload(payload) {
  try {
    const normalized = normalizePendingPayload(payload);
    if (!normalized) return false;

    await storageSetLocal({
      [PENDING_PAYLOAD_KEY]: normalized,
    });

    return true;
  } catch {
    return false;
  }
}

async function readPendingPayload() {
  try {
    const raw = await storageGetLocal(PENDING_PAYLOAD_KEY);
    if (!raw || typeof raw !== 'object') return null;

    const ts = Number(raw._ts || 0);
    if (!ts || (Date.now() - ts) > PENDING_TTL_MS) {
      await storageRemoveLocal(PENDING_PAYLOAD_KEY);
      return null;
    }

    return raw;
  } catch {
    return null;
  }
}

async function clearPendingPayload() {
  try {
    await storageRemoveLocal(PENDING_PAYLOAD_KEY);
    return true;
  } catch {
    return false;
  }
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

  if (msg.type === 'openRatingForPayload') {
    (async () => {
      const payload = msg.payload || {};
      const result = await checkDealStatusWithBackend(payload);

      if (result?.ok === true && result?.canRate === true && result?.alreadyRated !== true) {
        const saved = await writePendingPayload(payload);
        if (!saved) {
          sendResponse({
            ok: false,
            opened: false,
            alreadyRated: false,
            canRate: false,
            error: 'Could not store pending payload in extension storage.',
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
        return;
      }

      if (result?.alreadyRated === true) {
        sendResponse({
          ok: true,
          opened: false,
          alreadyRated: true,
          canRate: false,
        });
        return;
      }

      sendResponse({
        ok: false,
        opened: false,
        alreadyRated: false,
        canRate: false,
        error: result?.error || 'Rating flow blocked by backend.',
      });
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

  if (msg.type === 'getPendingPayloadForPage') {
    (async () => {
      const payload = await readPendingPayload();

      sendResponse({
        ok: !!payload,
        payload: payload || null,
      });
    })();
    return true;
  }

  if (msg.type === 'clearPendingPayloadForPage') {
    (async () => {
      const ok = await clearPendingPayload();
      sendResponse({
        ok: !!ok,
        cleared: !!ok,
      });
    })();
    return true;
  }
});