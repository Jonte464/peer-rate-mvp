// frontend/modules/pendingStore.js
const PENDING_KEY = 'peerrate_pending_rating_v2';
const TTL_MS = 1000 * 60 * 60 * 24;

// ✅ Ny: lokal cache över redan betygsatta deals (för att kunna “stänga av” spök-pending)
const RATED_CACHE_KEY = 'peerrate_rated_deals_v1';
const RATED_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 dagar

function now() { return Date.now(); }
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

function readB64Json(b64) {
  if (!b64) return null;
  try {
    const cleaned = decodeURIComponent(b64);

    // 1) vanilla atob
    try {
      const raw = atob(cleaned);
      const j = safeParse(raw);
      if (j && typeof j === 'object') return j;
    } catch {}

    // 2) UTF-8 variant
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

export function setPending(data) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...(data || {}), _ts: now() })); } catch {}
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
    return parsed;
  } catch {
    return null;
  }
}

export function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
  // signalera så UI kan uppdatera
  try { window.dispatchEvent(new CustomEvent("pr:pending-cleared")); } catch {}
}

/* -----------------------------
   ✅ RATED DEALS CACHE
------------------------------ */

function normalizeSource(s) {
  return String(s || '').trim().toLowerCase();
}

function normalizeProofRef(s) {
  return String(s || '').trim().toLowerCase();
}

export function dealKeyFromPending(p) {
  const source = normalizeSource(p?.source || p?.deal?.source || p?.counterparty?.source || '');
  // proofRef kan ligga på flera ställen
  const proofRef =
    normalizeProofRef(
      p?.proofRef ||
      p?.deal?.orderId ||
      p?.deal?.proofRef ||
      p?.counterparty?.orderId ||
      p?.counterparty?.proofRef ||
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
      if (!ts || (t - ts) > RATED_TTL_MS) delete o[k];
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

    // skriv tillbaka efter cleanup (optional)
    writeRatedCacheRaw(cache);

    return !!cache[key];
  } catch {
    return false;
  }
}

export function normalizeIncoming(inObj) {
  const obj = (inObj && typeof inObj === 'object') ? { ...inObj } : {};
  const out = { ...obj };

  out.source = out.source || obj.source || '';
  out.pageUrl = out.pageUrl || obj.pageUrl || '';

  const deal = obj.deal || obj.counterparty?.deal || null;
  const cp = (deal && deal.counterparty) ? deal.counterparty : (obj.counterparty || null);

  out.subjectEmail =
    obj.subjectEmail ||
    cp?.email ||
    obj.subject ||
    '';

  out.counterparty = {
    ...(obj.counterparty && typeof obj.counterparty === 'object' ? obj.counterparty : {}),
    ...(cp && typeof cp === 'object' ? cp : {}),
  };

  out.deal = deal && typeof deal === 'object' ? deal : (obj.deal || undefined);

  out.proofRef =
    obj.proofRef ||
    deal?.orderId ||
    obj.counterparty?.orderId ||
    out.pageUrl ||
    '';

  const s = String(out.source || '').toLowerCase();
  if (s === 'tradera') out.source = 'Tradera';

  return out;
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

  // 1) pr=... (base64 json)
  if (pr) {
    const decoded = readB64Json(pr);
    if (decoded && typeof decoded === 'object') {
      if (!decoded.source && source) decoded.source = source;
      if (!decoded.pageUrl && pageUrl) decoded.pageUrl = pageUrl;
      if (!decoded.proofRef && proofRef) decoded.proofRef = proofRef;

      const normalized = normalizeIncoming(decoded);
      setPending(normalized);

      // remove params
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

  // 2) fallback merge query into existing pending
  const existing = getPending() || {};
  const merged = normalizeIncoming({
    ...existing,
    source: source || existing.source,
    pageUrl: pageUrl || existing.pageUrl,
    proofRef: proofRef || existing.proofRef,
  });

  setPending(merged);

  // remove params
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('source');
    url.searchParams.delete('pageUrl');
    url.searchParams.delete('proofRef');
    window.history.replaceState({}, '', url.toString());
  } catch {}

  return merged;
}