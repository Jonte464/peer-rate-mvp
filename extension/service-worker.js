// extension/service-worker.js
// PeerRate background/service-worker
// Extremt förenklad transport:
// - kontrollera med backend om affären får betygsättas
// - öppna rate.html med all viktig data direkt i URL-parametrar
// - ingen bridge krävs för att grundflödet ska fungera
//
// Dubbelbetygsspärr behålls.

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

function setIf(qs, key, value) {
  const v = normalizeText(value);
  if (v) qs.set(key, v);
}

function buildRateUrl(payload) {
  const deal = payload?.deal || {};
  const cp = payload?.counterparty || deal?.counterparty || {};

  const source = normalizeSource(payload?.source || deal?.platform || '');
  const pageUrl = normalizeText(payload?.pageUrl || deal?.pageUrl || '');
  const proofRef = extractProofRef(payload);

  const qs = new URLSearchParams();

  setIf(qs, 'source', source);
  setIf(qs, 'pageUrl', pageUrl);
  setIf(qs, 'proofRef', proofRef);

  setIf(qs, 'subjectEmail', payload?.subjectEmail || cp?.email);
  setIf(qs, 'cpEmail', cp?.email);
  setIf(qs, 'cpName', cp?.name);
  setIf(qs, 'cpPhone', cp?.phone);
  setIf(qs, 'cpAddressStreet', cp?.addressStreet);
  setIf(qs, 'cpAddressZip', cp?.addressZip);
  setIf(qs, 'cpAddressCity', cp?.addressCity);
  setIf(qs, 'cpCountry', cp?.country);
  setIf(qs, 'cpPlatform', cp?.platform);
  setIf(qs, 'cpPlatformUsername', cp?.platformUsername || cp?.username);
  setIf(qs, 'cpOrderId', cp?.orderId);
  setIf(qs, 'cpItemId', cp?.itemId);
  setIf(qs, 'cpAmountSek', cp?.amountSek);
  setIf(qs, 'cpTitle', cp?.title);

  setIf(qs, 'dealPlatform', deal?.platform);
  setIf(qs, 'dealOrderId', deal?.orderId);
  setIf(qs, 'dealItemId', deal?.itemId);
  setIf(qs, 'dealTitle', deal?.title);
  setIf(qs, 'dealAmount', deal?.amount);
  setIf(qs, 'dealAmountSek', deal?.amountSek);
  setIf(qs, 'dealCurrency', deal?.currency);
  setIf(qs, 'dealDate', deal?.date);
  setIf(qs, 'dealDateISO', deal?.dateISO);

  return `${RATE_PAGE_BASE}?${qs.toString()}`;
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
});