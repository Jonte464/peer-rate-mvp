// frontend/modules/pendingStore.js
// MINIMAL VERSION
// Primär väg:
// rate.html#pr=BASE64_JSON
//
// Den här filen gör bara tre saker:
// 1) läsa payload från hash
// 2) spara i localStorage
// 3) läsa/rensa localStorage
//
// Ingen bridge
// Ingen query-logik
// Ingen extra fallback-arkitektur

const PENDING_KEY = 'peerrate_pending_rating_v6';
const TTL_MS = 1000 * 60 * 60 * 24;

const RATED_CACHE_KEY = 'peerrate_rated_deals_v1';
const RATED_TTL_MS = 1000 * 60 * 60 * 24 * 90;

function now() {
  return Date.now();
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function dispatchPendingUpdated(detail) {
  try {
    window.dispatchEvent(new CustomEvent('pr:pending-updated', { detail: detail || {} }));
  } catch {}
}

function dispatchPendingCleared() {
  try {
    window.dispatchEvent(new CustomEvent('pr:pending-cleared'));
  } catch {}
}

function normalizeText(v) {
  return String(v || '').trim();
}

function normalizeSourceDisplay(source) {
  const s = normalizeText(source).toLowerCase();

  if (s === 'tradera') return 'Tradera';
  if (s === 'blocket') return 'Blocket';
  if (s === 'airbnb') return 'Airbnb';
  if (s === 'ebay') return 'eBay';
  if (s === 'tiptap') return 'Tiptap';
  if (s === 'hygglo') return 'Hygglo';
  if (s === 'husknuten') return 'Husknuten';
  if (s === 'facebook') return 'Facebook Marketplace';

  return normalizeText(source);
}

function normalizeIncoming(inObj) {
  const obj = inObj && typeof inObj === 'object' ? { ...inObj } : {};
  const out = { ...obj };

  const deal = obj.deal && typeof obj.deal === 'object' ? { ...obj.deal } : null;
  const rawCounterparty =
    obj.counterparty && typeof obj.counterparty === 'object' ? { ...obj.counterparty } : null;

  out.source =
    normalizeSourceDisplay(
      obj.source ||
      deal?.platform ||
      rawCounterparty?.platform ||
      ''
    ) || '';

  out.pageUrl =
    normalizeText(
      obj.pageUrl ||
      deal?.pageUrl ||
      rawCounterparty?.pageUrl ||
      ''
    ) || '';

  out.counterparty = {
    ...(rawCounterparty || {})
  };

  out.deal = deal || undefined;

  out.subjectEmail =
    normalizeText(
      obj.subjectEmail ||
      out.counterparty?.email ||
      ''
    ) || '';

  out.proofRef =
    normalizeText(
      obj.proofRef ||
      deal?.orderId ||
      out.counterparty?.orderId ||
      out.pageUrl ||
      ''
    ) || '';

  if (out.counterparty?.email) {
    out.counterparty.email = normalizeText(out.counterparty.email).toLowerCase();
  }

  if (out.subjectEmail) {
    out.subjectEmail = normalizeText(out.subjectEmail).toLowerCase();
  }

  Object.keys(out).forEach((k) => {
    if (out[k] === undefined) delete out[k];
  });

  return out;
}

function mergePendingData(baseObj, incomingObj) {
  const base = normalizeIncoming(baseObj || {});
  const incoming = normalizeIncoming(incomingObj || {});

  return normalizeIncoming({
    ...base,
    ...incoming,
    counterparty: {
      ...(base.counterparty || {}),
      ...(incoming.counterparty || {})
    },
    deal: {
      ...(base.deal || {}),
      ...(incoming.deal || {})
    }
  });
}

export function setPending(data) {
  try {
    const existing = getPending();
    const normalized = existing
      ? mergePendingData(existing, data || {})
      : normalizeIncoming(data || {});

    const payload = { ...normalized, _ts: now() };
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    dispatchPendingUpdated(payload);
  } catch {}
}

export function getPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!parsed) return null;

    if (now() - (parsed._ts || 0) > TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }

    return normalizeIncoming(parsed);
  } catch {
    return null;
  }
}

export function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
  dispatchPendingCleared();
}

function readPayloadFromHash() {
  try {
    const hash = String(window.location.hash || '');
    if (!hash.startsWith('#pr=')) return null;

    const encoded = hash.slice(4);
    if (!encoded) return null;

    const cleaned = decodeURIComponent(encoded);
    const raw = atob(cleaned);
    const utf8 = decodeURIComponent(escape(raw));
    const parsed = safeParse(utf8);

    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeIncoming(parsed);
  } catch {
    return null;
  }
}

export function captureFromUrl() {
  const fromHash = readPayloadFromHash();
  if (!fromHash) return null;

  const existing = getPending() || {};
  const merged = mergePendingData(existing, fromHash);
  setPending(merged);

  try {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState({}, '', url.toString());
  } catch {}

  return merged;
}

function normalizeSource(s) {
  return String(s || '').trim().toLowerCase();
}

function normalizeProofRef(s) {
  return String(s || '').trim().toLowerCase();
}

export function dealKeyFromPending(p) {
  const source = normalizeSource(
    p?.source ||
    p?.deal?.platform ||
    p?.counterparty?.platform ||
    ''
  );

  const proofRef = normalizeProofRef(
    p?.proofRef ||
    p?.deal?.orderId ||
    p?.counterparty?.orderId ||
    p?.pageUrl ||
    ''
  );

  if (!source || !proofRef) return '';
  return `${source}|${proofRef}`;
}

function readRatedCacheRaw() {
  try {
    const raw = localStorage.getItem(RATED_CACHE_KEY);
    const obj = raw ? safeParse(raw) : null;
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeRatedCacheRaw(obj) {
  try {
    localStorage.setItem(RATED_CACHE_KEY, JSON.stringify(obj || {}));
  } catch {}
}

function cleanupRatedCache(obj) {
  try {
    const o = obj || {};
    const t = now();

    for (const k of Object.keys(o)) {
      const ts = Number(o[k] || 0);
      if (!ts || t - ts > RATED_TTL_MS) delete o[k];
    }

    return o;
  } catch {
    return obj || {};
  }
}

export function markDealRated(pendingOrKey) {
  try {
    const key = typeof pendingOrKey === 'string' ? pendingOrKey : dealKeyFromPending(pendingOrKey);
    if (!key) return;

    let cache = readRatedCacheRaw();
    cache = cleanupRatedCache(cache);
    cache[key] = now();
    writeRatedCacheRaw(cache);
  } catch {}
}

export function isDealRated(pendingOrKey) {
  try {
    const key = typeof pendingOrKey === 'string' ? pendingOrKey : dealKeyFromPending(pendingOrKey);
    if (!key) return false;

    let cache = readRatedCacheRaw();
    cache = cleanupRatedCache(cache);
    writeRatedCacheRaw(cache);

    return !!cache[key];
  } catch {
    return false;
  }
}

// Behålls bara för kompatibilitet med befintlig ratingForm.js
export async function captureFromExtensionBridge() {
  return getPending();
}