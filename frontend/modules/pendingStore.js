// frontend/modules/pendingStore.js
// Förenklad pending-store.
// Primär källa: full payload i URL-parametern "pr"
// Sekundär källa: extension bridge
// Tertiär fallback: tunn querydata
// Lokal lagring: localStorage

const PENDING_KEY = 'peerrate_pending_rating_v4';
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

function readB64Json(b64) {
  if (!b64) return null;

  try {
    const cleaned = decodeURIComponent(b64);

    try {
      const raw = atob(cleaned);
      const utf8 = decodeURIComponent(escape(raw));
      const parsed = safeParse(utf8);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}

    try {
      const raw2 = atob(cleaned);
      const parsed2 = safeParse(raw2);
      if (parsed2 && typeof parsed2 === 'object') return parsed2;
    } catch {}

    return null;
  } catch {
    return null;
  }
}

export function hasRichPendingData(p) {
  return !!(
    p?.subjectEmail ||
    p?.counterparty?.email ||
    p?.counterparty?.name ||
    p?.counterparty?.phone ||
    p?.counterparty?.addressStreet ||
    p?.counterparty?.addressCity ||
    p?.deal?.orderId ||
    p?.deal?.itemId ||
    p?.deal?.title ||
    p?.deal?.amount != null ||
    p?.deal?.amountSek != null ||
    p?.deal?.date ||
    p?.deal?.dateISO
  );
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

function mergePendingData(baseObj, incomingObj) {
  const base = normalizeIncoming(baseObj || {});
  const incoming = normalizeIncoming(incomingObj || {});

  const merged = {
    ...base,
    ...incoming,
    counterparty: {
      ...(base.counterparty || {}),
      ...(incoming.counterparty || {}),
    },
    deal: {
      ...(base.deal || {}),
      ...(incoming.deal || {}),
      counterparty: {
        ...(base.deal?.counterparty || {}),
        ...(incoming.deal?.counterparty || {}),
      },
    },
  };

  if (!incoming.subjectEmail && base.subjectEmail) merged.subjectEmail = base.subjectEmail;
  if (!incoming.proofRef && base.proofRef) merged.proofRef = base.proofRef;
  if (!incoming.pageUrl && base.pageUrl) merged.pageUrl = base.pageUrl;
  if (!incoming.source && base.source) merged.source = base.source;

  return normalizeIncoming(merged);
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

export function captureFromUrl() {
  const qs = new URLSearchParams(window.location.search || '');
  const pr = qs.get('pr');
  const source = qs.get('source') || '';
  const pageUrl = qs.get('pageUrl') || '';
  const proofRef = qs.get('proofRef') || '';

  let result = null;

  if (pr) {
    const decoded = readB64Json(pr);
    if (decoded && typeof decoded === 'object') {
      const existing = getPending() || {};
      const merged = mergePendingData(existing, decoded);
      setPending(merged);
      result = merged;
    }
  }

  if (!result && (source || pageUrl || proofRef)) {
    const existing = getPending() || {};
    const merged = mergePendingData(existing, {
      source: source || existing.source,
      pageUrl: pageUrl || existing.pageUrl,
      proofRef: proofRef || existing.proofRef,
    });
    setPending(merged);
    result = merged;
  }

  if (pr || source || pageUrl || proofRef) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('pr');
      url.searchParams.delete('source');
      url.searchParams.delete('pageUrl');
      url.searchParams.delete('proofRef');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  return result;
}

export async function captureFromExtensionBridge(timeoutMs = 1800) {
  return new Promise((resolve) => {
    let done = false;
    let timer = null;

    const finish = (value) => {
      if (done) return;
      done = true;

      try {
        window.removeEventListener('message', onMessage);
      } catch {}

      if (timer) clearTimeout(timer);
      resolve(value || null);
    };

    const onMessage = (event) => {
      try {
        if (event.source !== window) return;
        if (!event.origin || !/^https:\/\/(www\.)?peerrate\.ai$/i.test(event.origin)) return;

        const data = event.data;
        if (!data || data.type !== 'PEERRATE_PENDING_PAYLOAD_RESPONSE') return;

        const payload = data?.payload?.payload || null;

        if (!payload || typeof payload !== 'object') {
          finish(null);
          return;
        }

        const existing = getPending();
        const normalized = existing
          ? mergePendingData(existing, payload)
          : normalizeIncoming(payload);

        setPending(normalized);

        try {
          window.postMessage(
            { type: 'PEERRATE_CLEAR_PENDING_PAYLOAD' },
            window.location.origin
          );
        } catch {}

        finish(normalized);
      } catch {
        finish(null);
      }
    };

    timer = setTimeout(() => finish(null), timeoutMs);

    try {
      window.addEventListener('message', onMessage);

      window.postMessage(
        { type: 'PEERRATE_REQUEST_PENDING_PAYLOAD' },
        window.location.origin
      );
    } catch {
      finish(null);
    }
  });
}