// extension/service-worker.js
// PeerRate background/service-worker
// Konservativ strategi:
// - backend måste uttryckligen svara canRate === true för att vi ska öppna rate.html
// - vid alreadyRated cachear vi lokalt
// - vid fel/timeout/oklart svar => öppna INTE
// - rate.html kan dessutom markera deals som rated tillbaka till extensionen
//
// Uppdatering:
// - PeerRate-identitet sparas fortfarande från peerrate.ai
// - aktiv marketplace-identitet skickas fortfarande med som signal/debug
// - men backend blockerar inte längre rating baserat på identity match

const API_BASE = "https://api.peerrate.ai";
const RATE_PAGE_BASE = "https://peerrate.ai/rate.html";

const RATED_CACHE_KEY = "peerrate_extension_rated_cache_v1";
const RATED_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 dagar

const AUTH_IDENTITY_KEY = "peerrate_extension_auth_identity_v1";

function normalizeText(v) {
  return String(v || "").trim();
}

function normalizeLower(v) {
  return normalizeText(v).toLowerCase();
}

function normalizeEmail(v) {
  return normalizeText(v).toLowerCase();
}

function normalizeSource(input) {
  const v = normalizeLower(input);

  if (v.includes("tradera")) return "tradera";
  if (v.includes("blocket")) return "blocket";
  if (v.includes("airbnb")) return "airbnb";
  if (v.includes("ebay")) return "ebay";
  if (v.includes("tiptap")) return "tiptap";
  if (v.includes("hygglo")) return "hygglo";
  if (v.includes("husknuten")) return "husknuten";
  if (v.includes("facebook")) return "facebook";

  return "other";
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
    ""
  );
}

function buildDealKey(payload) {
  const source = normalizeSource(payload?.source || payload?.deal?.platform || "");
  const proofRef = normalizeLower(extractProofRef(payload));
  if (!source || !proofRef) return "";
  return `${source}|${proofRef}`;
}

function encodePayload(payload) {
  const json = JSON.stringify(payload || {});
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}

function buildRateUrl(payload) {
  const pageUrl = payload?.pageUrl || "";
  const proofRef = extractProofRef(payload);
  const source = normalizeSource(payload?.source || payload?.deal?.platform || "");

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

function storageRemoveLocal(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, () => resolve(true));
  });
}

function normalizePeerRateIdentity(identity) {
  const out = {
    id: normalizeText(identity?.id || ""),
    email: normalizeEmail(identity?.email || identity?.subjectRef || ""),
    subjectRef: normalizeEmail(identity?.subjectRef || identity?.email || ""),
    fullName: normalizeText(identity?.fullName || ""),
    syncedAt: normalizeText(identity?.syncedAt || new Date().toISOString()),
  };

  if (!out.email && !out.subjectRef && !out.id) return null;
  return out;
}

async function readAuthIdentity() {
  try {
    const raw = await storageGetLocal(AUTH_IDENTITY_KEY);
    const normalized = normalizePeerRateIdentity(raw || {});
    return normalized || null;
  } catch {
    return null;
  }
}

async function writeAuthIdentity(identity) {
  try {
    const normalized = normalizePeerRateIdentity(identity || {});
    if (!normalized) return false;
    await storageSetLocal({ [AUTH_IDENTITY_KEY]: normalized });
    return true;
  } catch {
    return false;
  }
}

async function clearAuthIdentity() {
  try {
    await storageRemoveLocal(AUTH_IDENTITY_KEY);
    return true;
  } catch {
    return false;
  }
}

async function readRatedCache() {
  try {
    const obj = (await storageGetLocal(RATED_CACHE_KEY)) || {};
    return obj && typeof obj === "object" ? obj : {};
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
  const key = typeof payloadOrKey === "string" ? payloadOrKey : buildDealKey(payloadOrKey);
  if (!key) return false;

  const cache = await cleanupRatedCache();
  cache[key] = Date.now();
  await writeRatedCache(cache);
  return true;
}

async function isDealRatedLocally(payloadOrKey) {
  const key = typeof payloadOrKey === "string" ? payloadOrKey : buildDealKey(payloadOrKey);
  if (!key) return false;

  const cache = await cleanupRatedCache();
  return !!cache[key];
}

function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);

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
  const source = normalizeSource(payload?.source || payload?.deal?.platform || "");
  const proofRef = extractProofRef(payload);
  const peerRateIdentity = await readAuthIdentity();

  if (!proofRef) {
    return {
      ok: false,
      alreadyRated: false,
      canRate: false,
      error: "Missing proofRef",
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
    const headers = {
      "Content-Type": "application/json",
    };

    if (peerRateIdentity?.email) {
      headers["x-user-email"] = peerRateIdentity.email;
    }

    const res = await fetchWithTimeout(
      `${API_BASE}/api/ratings/check-deal-status`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          channel: "extension",
          source,
          proofRef,
          pageUrl: payload?.pageUrl || "",
          peerRateIdentity: peerRateIdentity || null,
          activeMarketplaceIdentity: payload?.activeMarketplaceIdentity || null,
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
        error: json?.error || "Backend check failed",
        raw: json?.raw || raw || null,
      };
    }

    if (json.alreadyRated === true || json.canRate === false) {
      if (json.alreadyRated === true) {
        await markDealRated({ source, proofRef });
      }

      return {
        ...json,
        ok: true,
        alreadyRated: !!json.alreadyRated,
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
      ok: false,
      alreadyRated: false,
      canRate: false,
      error: "Ambiguous backend response",
      raw: json,
    };
  } catch (err) {
    console.warn("[PeerRate extension] checkDealStatusWithBackend failed:", err);
    return {
      ok: false,
      alreadyRated: false,
      canRate: false,
      error: String(err?.message || err || "Unknown error"),
    };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "syncAuthIdentityFromPage") {
    (async () => {
      const ok = await writeAuthIdentity(msg.payload || {});
      const stored = await readAuthIdentity();

      sendResponse({
        ok: !!ok,
        stored: !!stored,
        email: stored?.email || null,
      });
    })();
    return true;
  }

  if (msg.type === "clearAuthIdentityFromPage") {
    (async () => {
      const ok = await clearAuthIdentity();
      sendResponse({ ok: !!ok, cleared: !!ok });
    })();
    return true;
  }

  if (msg.type === "checkDealStatus") {
    (async () => {
      const result = await checkDealStatusWithBackend(msg.payload || {});
      sendResponse(result);
    })();
    return true;
  }

  if (msg.type === "openRatingForPayload") {
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
        error: result?.error || "Rating flow blocked because backend did not explicitly allow it.",
      });
    })();
    return true;
  }

  if (msg.type === "markDealRatedFromPage") {
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