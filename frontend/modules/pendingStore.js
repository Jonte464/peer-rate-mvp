// frontend/modules/pendingStore.js
// Robust pending-store.
// Läser i denna ordning:
// 1) hash-parametern #pr=...
// 2) query-parametern ?pr=...
// 3) vanliga query-parametrar som fallback
// 4) localStorage
//
// Hash-baserad transport är nu primär väg från extension.

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

function getHashParams() {
  try {
    const raw = String(window.location.hash || '');
    const cleaned = raw.startsWith('#') ? raw.slice(1) : raw;
    return new URLSearchParams(cleaned);
  } catch {
    return new URLSearchParams();
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

function readPayloadFromHashOrPr() {
  const hashParams = getHashParams();
  const queryParams = new URLSearchParams(window.location.search || '');

  const prHash = hashParams.get('pr');
  const prQuery = queryParams.get('pr');

  const decoded = readB64Json(prHash || prQuery);
  if (!decoded || typeof decoded !== 'object') return null;

  return normalizeIncoming(decoded);
}

function readLegacyParamsFromQuery() {
  const qs = new URLSearchParams(window.location.search || '');

  const source = qs.get('source') || '';
  const pageUrl = qs.get('pageUrl') || '';
  const proofRef = qs.get('proofRef') || '';

  const subjectEmail = qs.get('subjectEmail') || '';
  const cpEmail = qs.get('cpEmail') || '';
  const cpName = qs.get('cpName') || '';
  const cpPhone = qs.get('cpPhone') || '';
  const cpAddressStreet = qs.get('cpAddressStreet') || '';
  const cpAddressZip = qs.get('cpAddressZip') || '';
  const cpAddressCity = qs.get('cpAddressCity') || '';
  const cpCountry = qs.get('cpCountry') || '';
  const cpPlatform = qs.get('cpPlatform') || '';
  const cpPlatformUsername = qs.get('cpPlatformUsername') || '';
  const cpOrderId = qs.get('cpOrderId') || '';
  const cpItemId = qs.get('cpItemId') || '';
  const cpAmountSek = qs.get('cpAmountSek') || '';
  const cpTitle = qs.get('cpTitle') || '';

  const dealPlatform = qs.get('dealPlatform') || '';
  const dealOrderId = qs.get('dealOrderId') || '';
  const dealItemId = qs.get('dealItemId') || '';
  const dealTitle = qs.get('dealTitle') || '';
  const dealAmount = qs.get('dealAmount') || '';
  const dealAmountSek = qs.get('dealAmountSek') || '';
  const dealCurrency = qs.get('dealCurrency') || '';
  const dealDate = qs.get('dealDate') || '';
  const dealDateISO = qs.get('dealDateISO') || '';

  const hasAnyRelevantParam = !!(
    source || pageUrl || proofRef ||
    subjectEmail || cpEmail || cpName || cpPhone ||
    cpAddressStreet || cpAddressZip || cpAddressCity || cpCountry ||
    dealOrderId || dealItemId || dealTitle || dealAmount || dealAmountSek || dealDate || dealDateISO
  );

  if (!hasAnyRelevantParam) {
    return null;
  }

  return normalizeIncoming({
    source,
    pageUrl,
    proofRef,
    subjectEmail,
    counterparty: {
      email: cpEmail,
      name: cpName,
      phone: cpPhone,
      addressStreet: cpAddressStreet,
      addressZip: cpAddressZip,
      addressCity: cpAddressCity,
      country: cpCountry,
      platform: cpPlatform,
      platformUsername: cpPlatformUsername,
      orderId: cpOrderId,
      itemId: cpItemId,
      amountSek: cpAmountSek ? Number(cpAmountSek) : undefined,
      title: cpTitle,
      pageUrl,
    },
    deal: {
      platform: dealPlatform || source,
      orderId: dealOrderId,
      itemId: dealItemId,
      title: dealTitle,
      amount: dealAmount ? Number(dealAmount) : undefined,
      amountSek: dealAmountSek ? Number(dealAmountSek) : undefined,
      currency: dealCurrency,
      date: dealDate,
      dateISO: dealDateISO,
      pageUrl,
    },
  });
}

export function captureFromUrl() {
  let result = null;

  const fromHash = readPayloadFromHashOrPr();
  if (fromHash) {
    const existing = getPending() || {};
    const merged = mergePendingData(existing, fromHash);
    setPending(merged);
    result = merged;
  }

  if (!result) {
    const fromLegacyQuery = readLegacyParamsFromQuery();
    if (fromLegacyQuery) {
      const existing = getPending() || {};
      const merged = mergePendingData(existing, fromLegacyQuery);
      setPending(merged);
      result = merged;
    }
  }

  try {
    const url = new URL(window.location.href);

    // rensa query
    [
      'pr',
      'source', 'pageUrl', 'proofRef',
      'subjectEmail',
      'cpEmail', 'cpName', 'cpPhone',
      'cpAddressStreet', 'cpAddressZip', 'cpAddressCity', 'cpCountry',
      'cpPlatform', 'cpPlatformUsername', 'cpOrderId', 'cpItemId', 'cpAmountSek', 'cpTitle',
      'dealPlatform', 'dealOrderId', 'dealItemId', 'dealTitle',
      'dealAmount', 'dealAmountSek', 'dealCurrency', 'dealDate', 'dealDateISO'
    ].forEach((key) => url.searchParams.delete(key));

    // rensa hash om det var payload där
    const hashParams = getHashParams();
    if (hashParams.get('pr')) {
      url.hash = '';
    }

    window.history.replaceState({}, '', url.toString());
  } catch {}

  return result;
}

// Behålls för kompatibilitet med befintlig kod.
export async function captureFromExtensionBridge() {
  return getPending();
}