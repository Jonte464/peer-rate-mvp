// frontend/modules/pendingStore.js
const PENDING_KEY = 'peerrate_pending_rating_v2';
const TTL_MS = 1000 * 60 * 60 * 24;

const RATED_CACHE_KEY = 'peerrate_rated_deals_v1';
const RATED_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 dagar

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

function readB64Json(b64) {
  if (!b64) return null;

  try {
    const cleaned = decodeURIComponent(b64);

    try {
      const raw = atob(cleaned);
      const j = safeParse(raw);
      if (j && typeof j === 'object') return j;
    } catch {}

    try {
      const raw = atob(cleaned);
      const utf8 = decodeURIComponent(escape(raw));
      const j2 = safeParse(utf8);
      if (j2 && typeof j2 === 'object') return j2;
    } catch {}

    return null;
  } catch {
    return null;
  }
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

export function normalizeIncoming(inObj) {
  const obj = inObj && typeof inObj === 'object' ? { ...inObj } : {};
  const out = { ...obj };

  const deal = obj.deal && typeof obj.deal === 'object' ? { ...obj.deal } : null;
  const nestedCp =
    deal?.counterparty && typeof deal.counterparty === 'object' ? { ...deal.counterparty } : null;

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
    ...(rawCounterparty || {}),
    ...(nestedCp || {}),
  };

  out.deal = deal || undefined;

  out.subjectEmail =
    normalizeText(
      obj.subjectEmail ||
        out.counterparty?.email ||
        obj.subject ||
        ''
    ) || '';

  out.proofRef =
    normalizeText(
      obj.proofRef ||
        deal?.orderId ||
        deal?.bookingId ||
        deal?.transactionId ||
        deal?.externalProofRef ||
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

  if (out.deal?.counterparty?.email) {
    out.deal.counterparty.email = normalizeText(out.deal.counterparty.email).toLowerCase();
  }

  Object.keys(out).forEach((k) => {
    if (out[k] === undefined) delete out[k];
  });

  return out;
}

export function setPending(data) {
  try {
    const normalized = normalizeIncoming(data || {});
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

/* -----------------------------
   Rated deals cache
------------------------------ */

function normalizeSource(s) {
  return String(s || '').trim().toLowerCase();
}

function normalizeProofRef(s) {
  return String(s || '').trim().toLowerCase();
}

export function dealKeyFromPending(p) {
  const source = normalizeSource(
    p?.source ||
      p?.deal?.source ||
      p?.deal?.platform ||
      p?.counterparty?.source ||
      p?.counterparty?.platform ||
      ''
  );

  const proofRef = normalizeProofRef(
    p?.proofRef ||
      p?.deal?.orderId ||
      p?.deal?.bookingId ||
      p?.deal?.transactionId ||
      p?.deal?.proofRef ||
      p?.counterparty?.orderId ||
      p?.counterparty?.proofRef ||
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

/**
 * Läser pending från URL:
 * - pr=<base64-json> (extension primary)
 * - eller source/pageUrl/proofRef (fallback)
 * Rensar query params efter capture så de inte återkommer vid refresh.
 */
export function captureFromUrl() {
  const qs = new URLSearchParams(window.location.search || '');
  const pr = qs.get('pr');
  const source = qs.get('source') || '';
  const pageUrl = qs.get('pageUrl') || '';
  const proofRef = qs.get('proofRef') || '';

  if (!pr && !source && !pageUrl && !proofRef) return null;

  if (pr) {
    const decoded = readB64Json(pr);
    if (decoded && typeof decoded === 'object') {
      if (!decoded.source && source) decoded.source = source;
      if (!decoded.pageUrl && pageUrl) decoded.pageUrl = pageUrl;
      if (!decoded.proofRef && proofRef) decoded.proofRef = proofRef;

      const normalized = normalizeIncoming(decoded);
      setPending(normalized);

      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('pr');
        url.searchParams.delete('source');
        url.searchParams.delete('pageUrl');
        url.searchParams.delete('proofRef');
        window.history.replaceState({}, '', url.toString());
      } catch {}

      return normalized;
    }
  }

  const existing = getPending() || {};
  const merged = normalizeIncoming({
    ...existing,
    source: source || existing.source,
    pageUrl: pageUrl || existing.pageUrl,
    proofRef: proofRef || existing.proofRef,
  });

  setPending(merged);

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('pr');
    url.searchParams.delete('source');
    url.searchParams.delete('pageUrl');
    url.searchParams.delete('proofRef');
    window.history.replaceState({}, '', url.toString());
  } catch {}

  return merged;
}