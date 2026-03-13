// frontend/js/rate-core.js
// Rate-sidan i två lägen:
// 1) Hub-läge utan payload
// 2) Fokuserat verifierat läge med payload
//
// Inloggning krävs för att skicka omdöme.
// Backend är source of truth för duplicate/deal-status.

import { createRating, checkDealStatus } from './rate-api.js';
import { getCurrentLanguage } from '/modules/landing/language.js';
import auth from '/modules/auth.js';

const PENDING_KEY = 'peerrate_pending_rating_v6';
const RATED_CACHE_KEY = 'peerrate_rated_deals_v1';
const PENDING_TTL_MS = 1000 * 60 * 60 * 24;
const RATED_TTL_MS = 1000 * 60 * 60 * 24 * 90;

const els = {};
let currentPending = null;
let currentUser = null;
let currentBackendAlreadyRated = false;
let lastStatus = { kind: 'warn', key: 'status_loading' };

const COPY = {
  sv: {
    page_title: 'PeerRate – Lämna betyg',
    hero_kicker: 'Verifierat betygsflöde',
    hero_title: 'Lämna betyg för en verifierad affär',
    hero_lead:
      'För att lämna ett verifierat omdöme börjar du från den plattform där affären genomfördes. Välj plattform nedan så skickas du vidare.',
    platform_select_label: 'Välj plattform',
    platform_select_placeholder: 'Välj…',
    platform_open: 'Öppna plattform',
    hub_foot:
      'När du har öppnat den avslutade affären på plattformen klickar du på PeerRate-extensionen för att komma tillbaka hit med verifierad affärsdata.',
    side_title_1: 'Så fungerar det',
    side_body_1:
      'Öppna en avslutad affär, låt extensionen skicka verifierad data till PeerRate och lämna sedan ditt omdöme här.',
    side_title_2: 'Varför detta är bättre',
    side_body_2:
      'Omdömet kopplas till en riktig transaktion i stället för ett öppet formulär utan bevis.',
    status_title: 'Status',
    verified_title: 'Verifierad affär',
    form_title: 'Lämna omdöme',
    form_foot: 'Omdömet skickas tillsammans med verifierad affärsreferens.',
    login_gate_title: 'Logga in för att lämna omdöme',
    login_gate_lead:
      'Du behöver vara inloggad i PeerRate för att kunna skicka omdömet för den verifierade affären.',
    login_btn: 'Logga in',
    signup_btn: 'Registrera dig',
    deal_head_title: 'Verifierad affär mottagen',
    deal_head_sub: 'Affärsdata från plattformen visas nedan.',
    no_deal_title: 'Ingen verifierad affär',
    no_deal_body: 'Ingen verifierad affär hittades.',
    score_label: 'Betyg',
    score_placeholder: 'Välj…',
    score_1: '1 – Mycket dåligt',
    score_2: '2 – Dåligt',
    score_3: '3 – Okej',
    score_4: '4 – Bra',
    score_5: '5 – Mycket bra',
    comment_label: 'Kommentar',
    comment_ph: 'Vad fungerade bra eller dåligt?',
    submit: 'Skicka omdöme',
    submit_anyway: 'Skicka ändå',
    submit_loading: 'Skickar…',
    submit_sent: 'Skickat',
    reload: 'Läs om affären',
    clear_pending: 'Rensa affärsdata',
    clear_rated: 'Rensa rated-cache',
    debug_title: 'Debug',
    debug_deal_key: 'Aktuell deal key',
    debug_rated: 'Markerad som rated lokalt',
    debug_payload: 'Decoded payload',
    debug_backend_rated: 'Backend alreadyRated',
    field_source: 'Källa',
    field_proofref: 'ProofRef',
    field_order_id: 'Order ID',
    field_item_id: 'Item ID',
    field_counterparty_email: 'Motpart e-post',
    field_name: 'Namn',
    field_phone: 'Telefon',
    field_address: 'Adress',
    field_title: 'Titel',
    field_amount: 'Belopp',
    field_date: 'Datum',
    field_source_link: 'Källsida',
    source_link_text: 'Öppna källsidan',
    unknown: '–',
    status_loading: 'Laddar…',
    status_hub: 'Välj en plattform för att initiera ett verifierat omdöme.',
    status_ready: 'Verifierad affär laddad och redo att betygsättas.',
    status_local_rated:
      'Den här affären är markerad som betygsatt lokalt. Det kan vara korrekt eller ett gammalt lokalt cachevärde. Du kan fortfarande försöka skicka omdömet igen.',
    status_backend_rated: 'Den här affären är redan betygsatt enligt backend.',
    status_no_payload: 'Ingen verifierad affär hittades.',
    status_missing_subject: 'Motpartens e-post saknas.',
    status_missing_score: 'Välj ett betyg innan du skickar.',
    status_missing_pending: 'Ingen verifierad affär finns att skicka.',
    status_duplicate_backend: 'Den här affären verkar redan vara betygsatt enligt backend.',
    status_saved: 'Tack! Ditt omdöme är sparat.',
    status_pending_cleared: 'Affärsdata rensad.',
    status_rated_cleared: 'Rated-cache rensad.',
    status_rated_cleared_no_pending: 'Rated-cache rensad. Ingen aktiv affär laddad just nu.',
    status_save_failed: 'Kunde inte skicka omdömet.',
    status_login_required: 'Du måste logga in för att skicka omdöme.',
    status_choose_platform: 'Välj en plattform först.',
    rated_true: 'true',
    rated_false: 'false',
  },
  en: {
    page_title: 'PeerRate – Leave a rating',
    hero_kicker: 'Verified rating flow',
    hero_title: 'Leave a rating for a verified deal',
    hero_lead:
      'To leave a verified rating, start from the platform where the deal was completed. Choose a platform below and continue from there.',
    platform_select_label: 'Choose platform',
    platform_select_placeholder: 'Choose…',
    platform_open: 'Open platform',
    hub_foot:
      'After opening the completed deal on the platform, click the PeerRate extension to return here with verified deal data.',
    side_title_1: 'How it works',
    side_body_1:
      'Open a completed deal, let the extension send verified data to PeerRate, and then leave your rating here.',
    side_title_2: 'Why this is better',
    side_body_2:
      'The rating is tied to a real transaction instead of an open form without proof.',
    status_title: 'Status',
    verified_title: 'Verified deal',
    form_title: 'Leave a rating',
    form_foot: 'The rating is sent together with a verified deal reference.',
    login_gate_title: 'Log in to leave a rating',
    login_gate_lead:
      'You need to be logged in to PeerRate before you can submit the rating for the verified deal.',
    login_btn: 'Log in',
    signup_btn: 'Sign up',
    deal_head_title: 'Verified deal received',
    deal_head_sub: 'Deal data from the platform is shown below.',
    no_deal_title: 'No verified deal',
    no_deal_body: 'No verified deal was found.',
    score_label: 'Rating',
    score_placeholder: 'Choose…',
    score_1: '1 – Very bad',
    score_2: '2 – Bad',
    score_3: '3 – Okay',
    score_4: '4 – Good',
    score_5: '5 – Very good',
    comment_label: 'Comment',
    comment_ph: 'What worked well or poorly?',
    submit: 'Submit rating',
    submit_anyway: 'Submit anyway',
    submit_loading: 'Submitting…',
    submit_sent: 'Submitted',
    reload: 'Reload deal',
    clear_pending: 'Clear deal data',
    clear_rated: 'Clear rated cache',
    debug_title: 'Debug',
    debug_deal_key: 'Current deal key',
    debug_rated: 'Marked as rated locally',
    debug_payload: 'Decoded payload',
    debug_backend_rated: 'Backend alreadyRated',
    field_source: 'Source',
    field_proofref: 'ProofRef',
    field_order_id: 'Order ID',
    field_item_id: 'Item ID',
    field_counterparty_email: 'Counterparty email',
    field_name: 'Name',
    field_phone: 'Phone',
    field_address: 'Address',
    field_title: 'Title',
    field_amount: 'Amount',
    field_date: 'Date',
    field_source_link: 'Source page',
    source_link_text: 'Open source page',
    unknown: '–',
    status_loading: 'Loading…',
    status_hub: 'Choose a platform to start a verified rating.',
    status_ready: 'Verified deal loaded and ready to be rated.',
    status_local_rated:
      'This deal is marked as rated locally. That may be correct or an old local cache value. You can still try to submit the rating again.',
    status_backend_rated: 'This deal is already rated according to the backend.',
    status_no_payload: 'No verified deal was found.',
    status_missing_subject: 'The counterparty email is missing.',
    status_missing_score: 'Please choose a rating before submitting.',
    status_missing_pending: 'There is no verified deal to submit.',
    status_duplicate_backend: 'This deal appears to already be rated according to the backend.',
    status_saved: 'Thanks! Your rating has been saved.',
    status_pending_cleared: 'Deal data cleared.',
    status_rated_cleared: 'Rated cache cleared.',
    status_rated_cleared_no_pending: 'Rated cache cleared. No active deal is currently loaded.',
    status_save_failed: 'Could not submit the rating.',
    status_login_required: 'You need to log in before you can submit a rating.',
    status_choose_platform: 'Choose a platform first.',
    rated_true: 'true',
    rated_false: 'false',
  },
};

const PLATFORM_LOGOS = {
  tradera: '/assets/marketplaces/tradera.png',
  blocket: '/assets/marketplaces/blocket.png',
  airbnb: '/assets/marketplaces/airbnb.png',
  ebay: '/assets/marketplaces/ebay.png',
  tiptap: '/assets/marketplaces/tiptap.png',
  hygglo: '/assets/marketplaces/hygglo.png',
  husknuten: '/assets/marketplaces/husknuten.png',
  facebook: '/assets/marketplaces/facebook.png',
  'facebook marketplace': '/assets/marketplaces/facebook.png',
};

const PLATFORM_LINKS = {
  tradera: 'https://www.tradera.com/',
  blocket: 'https://www.blocket.se/',
  airbnb: 'https://www.airbnb.com/',
  ebay: 'https://www.ebay.com/',
  facebook: 'https://www.facebook.com/marketplace/',
};

function now() {
  return Date.now();
}

function $(id) {
  return document.getElementById(id);
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeText(v) {
  return String(v || '').trim();
}

function normalizeLower(v) {
  return normalizeText(v).toLowerCase();
}

function lang() {
  const current = getCurrentLanguage();
  return current === 'sv' ? 'sv' : 'en';
}

function L(key, fallback = '') {
  const dict = COPY[lang()] || COPY.en;
  return dict[key] != null ? dict[key] : fallback || key;
}

function normalizeSourceDisplay(source) {
  const s = normalizeLower(source);

  if (s === 'tradera') return 'Tradera';
  if (s === 'blocket') return 'Blocket';
  if (s === 'airbnb') return 'Airbnb';
  if (s === 'ebay') return 'eBay';
  if (s === 'tiptap') return 'Tiptap';
  if (s === 'hygglo') return 'Hygglo';
  if (s === 'husknuten') return 'Husknuten';
  if (s === 'facebook') return 'Facebook Marketplace';
  if (s === 'facebook marketplace') return 'Facebook Marketplace';

  return normalizeText(source);
}

function normalizeIncoming(inObj) {
  const obj = inObj && typeof inObj === 'object' ? { ...inObj } : {};
  const deal = obj.deal && typeof obj.deal === 'object' ? { ...obj.deal } : {};
  const cp = obj.counterparty && typeof obj.counterparty === 'object' ? { ...obj.counterparty } : {};

  return {
    source: normalizeSourceDisplay(obj.source || deal.platform || cp.platform || ''),
    pageUrl: normalizeText(obj.pageUrl || deal.pageUrl || cp.pageUrl || ''),
    proofRef: normalizeText(obj.proofRef || deal.orderId || cp.orderId || obj.pageUrl || ''),
    subjectEmail: normalizeText(obj.subjectEmail || cp.email || '').toLowerCase(),
    counterparty: {
      ...cp,
      email: normalizeText(cp.email || '').toLowerCase(),
      name: normalizeText(cp.name || ''),
      phone: normalizeText(cp.phone || ''),
      addressStreet: normalizeText(cp.addressStreet || ''),
      addressZip: normalizeText(cp.addressZip || ''),
      addressCity: normalizeText(cp.addressCity || ''),
      country: normalizeText(cp.country || ''),
      platform: normalizeText(cp.platform || deal.platform || ''),
      orderId: normalizeText(cp.orderId || deal.orderId || ''),
      itemId: normalizeText(cp.itemId || deal.itemId || ''),
      title: normalizeText(cp.title || deal.title || ''),
      pageUrl: normalizeText(cp.pageUrl || deal.pageUrl || obj.pageUrl || ''),
      amountSek: cp.amountSek ?? deal.amount ?? null,
    },
    deal: {
      ...deal,
      platform: normalizeText(deal.platform || cp.platform || ''),
      orderId: normalizeText(deal.orderId || cp.orderId || ''),
      itemId: normalizeText(deal.itemId || cp.itemId || ''),
      title: normalizeText(deal.title || cp.title || ''),
      amount: deal.amount ?? cp.amountSek ?? null,
      currency: normalizeText(deal.currency || ''),
      date: normalizeText(deal.date || ''),
      dateISO: normalizeText(deal.dateISO || ''),
      pageUrl: normalizeText(deal.pageUrl || cp.pageUrl || obj.pageUrl || ''),
    },
  };
}

function mergePending(baseObj, incomingObj) {
  const base = normalizeIncoming(baseObj || {});
  const incoming = normalizeIncoming(incomingObj || {});

  return normalizeIncoming({
    ...base,
    ...incoming,
    counterparty: {
      ...(base.counterparty || {}),
      ...(incoming.counterparty || {}),
    },
    deal: {
      ...(base.deal || {}),
      ...(incoming.deal || {}),
    },
  });
}

function decodeHashPayload() {
  try {
    const rawHash = String(window.location.hash || '');
    if (!rawHash.startsWith('#pr=')) return null;

    const encoded = rawHash.slice(4);
    if (!encoded) return null;

    const cleaned = decodeURIComponent(encoded);
    const raw = atob(cleaned);
    const utf8 = decodeURIComponent(escape(raw));
    const parsed = safeParse(utf8);

    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeIncoming(parsed);
  } catch (err) {
    console.warn('[PeerRate rate-core] decodeHashPayload failed:', err);
    return null;
  }
}

function writePending(payload) {
  try {
    const existing = readPending();
    const merged = existing ? mergePending(existing, payload) : normalizeIncoming(payload || {});
    const obj = {
      ...merged,
      _ts: now(),
    };
    localStorage.setItem(PENDING_KEY, JSON.stringify(obj));
    return merged;
  } catch (err) {
    console.warn('[PeerRate rate-core] writePending failed:', err);
    return null;
  }
}

function readPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!parsed) return null;

    const ts = Number(parsed._ts || 0);
    if (!ts || now() - ts > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }

    return normalizeIncoming(parsed);
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
}

function dealKeyFromPending(p) {
  const source = normalizeLower(
    p?.source ||
    p?.deal?.platform ||
    p?.counterparty?.platform ||
    ''
  );

  const proofRef = normalizeLower(
    p?.proofRef ||
    p?.deal?.orderId ||
    p?.counterparty?.orderId ||
    p?.pageUrl ||
    ''
  );

  if (!source || !proofRef) return '';
  return `${source}|${proofRef}`;
}

function readRatedCache() {
  try {
    const raw = localStorage.getItem(RATED_CACHE_KEY);
    const obj = raw ? safeParse(raw) : null;
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeRatedCache(obj) {
  try {
    localStorage.setItem(RATED_CACHE_KEY, JSON.stringify(obj || {}));
  } catch {}
}

function clearRatedCache() {
  try {
    localStorage.removeItem(RATED_CACHE_KEY);
  } catch {}
}

function removeDealRated(p) {
  const key = typeof p === 'string' ? p : dealKeyFromPending(p);
  if (!key) return;

  const cache = cleanupRatedCache();
  if (cache[key]) {
    delete cache[key];
    writeRatedCache(cache);
  }
}

function cleanupRatedCache() {
  const cache = readRatedCache();
  const t = now();
  let changed = false;

  for (const k of Object.keys(cache)) {
    const ts = Number(cache[k] || 0);
    if (!ts || t - ts > RATED_TTL_MS) {
      delete cache[k];
      changed = true;
    }
  }

  if (changed) {
    writeRatedCache(cache);
  }

  return cache;
}

function markDealRated(p) {
  const key = typeof p === 'string' ? p : dealKeyFromPending(p);
  if (!key) return;

  const cache = cleanupRatedCache();
  cache[key] = now();
  writeRatedCache(cache);
}

function isDealRated(p) {
  const key = typeof p === 'string' ? p : dealKeyFromPending(p);
  if (!key) return false;

  const cache = cleanupRatedCache();
  return !!cache[key];
}

function shouldShowDebug() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('debug') === '1') return true;
    if (localStorage.getItem('peerrate_debug') === '1') return true;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return true;
    return false;
  } catch {
    return false;
  }
}

function setStatus(kind, key) {
  lastStatus = { kind, key };
  els.statusBox.className = `notice ${kind}`;
  els.statusBox.textContent = L(key, key);
}

function renderField(label, value) {
  return `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value || L('unknown'))}</div>
    </div>
  `;
}

function renderLinkField(label, href) {
  const safeHref = normalizeText(href);
  const linkHtml = safeHref
    ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(L('source_link_text'))}</a>`
    : escapeHtml(L('unknown'));

  return `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${linkHtml}</div>
    </div>
  `;
}

function formatAddress(cp) {
  return [
    cp?.addressStreet,
    cp?.addressZip,
    cp?.addressCity,
    cp?.country,
  ].filter(Boolean).join(', ');
}

function formatAmount(p) {
  const amount = p?.deal?.amount ?? p?.counterparty?.amountSek ?? null;
  const currency = p?.deal?.currency || (amount != null ? 'SEK' : '');

  if (amount == null || amount === '') return '';
  return `${amount} ${currency}`.trim();
}

function getPlatformLogo(source) {
  const key = normalizeLower(source);
  return PLATFORM_LOGOS[key] || '/assets/Logo.PNG';
}

function updatePlatformPresentation(payload) {
  const source = payload?.source || payload?.deal?.platform || payload?.counterparty?.platform || '';
  const displaySource = normalizeSourceDisplay(source) || 'PeerRate';

  els.platformLogo.src = getPlatformLogo(displaySource);
  els.platformLogo.alt = displaySource;
  els.platformChip.textContent = displaySource;
}

function renderDeal(payload) {
  if (!payload) {
    els.dealHeadTitle.textContent = L('no_deal_title');
    els.dealHeadSub.textContent = L('no_deal_body');
    els.platformChip.textContent = 'PeerRate';
    els.platformLogo.src = '/assets/Logo.PNG';
    els.platformLogo.alt = 'PeerRate';

    els.dealGrid.innerHTML = `
      <div class="field" style="grid-column:1/-1;">
        <div class="label">${escapeHtml(L('status_title'))}</div>
        <div class="value">${escapeHtml(L('no_deal_body'))}</div>
      </div>
    `;
    return;
  }

  const p = payload;
  const cp = p.counterparty || {};
  const deal = p.deal || {};

  els.dealHeadTitle.textContent = L('deal_head_title');
  els.dealHeadSub.textContent = L('deal_head_sub');
  updatePlatformPresentation(p);

  els.dealGrid.innerHTML = [
    renderField(L('field_source'), p.source || deal.platform || ''),
    renderField(L('field_proofref'), p.proofRef || ''),
    renderField(L('field_order_id'), deal.orderId || cp.orderId || ''),
    renderField(L('field_item_id'), deal.itemId || cp.itemId || ''),
    renderField(L('field_counterparty_email'), p.subjectEmail || cp.email || ''),
    renderField(L('field_name'), cp.name || ''),
    renderField(L('field_phone'), cp.phone || ''),
    renderField(L('field_address'), formatAddress(cp)),
    renderField(L('field_title'), deal.title || cp.title || ''),
    renderField(L('field_amount'), formatAmount(p)),
    renderField(L('field_date'), deal.date || deal.dateISO || ''),
    renderLinkField(L('field_source_link'), p.pageUrl || deal.pageUrl || cp.pageUrl || ''),
  ].join('');
}

function refreshDebug(payload) {
  if (!els.debugCard) return;

  const currentPayload = payload || null;
  const dealKey = currentPayload ? dealKeyFromPending(currentPayload) : '';
  const rated = currentPayload ? isDealRated(currentPayload) : false;
  const ratedCache = cleanupRatedCache();

  els.hrefOut.textContent = window.location.href || '';
  els.hashOut.textContent = window.location.hash || '';
  els.dealKeyOut.textContent = dealKey || L('unknown');
  els.ratedOut.textContent = currentPayload ? (rated ? L('rated_true') : L('rated_false')) : L('unknown');
  els.backendRatedOut.textContent = currentPayload ? (currentBackendAlreadyRated ? L('rated_true') : L('rated_false')) : L('unknown');
  els.lsOut.textContent = localStorage.getItem(PENDING_KEY) || 'null';
  els.ratedCacheOut.textContent = JSON.stringify(ratedCache, null, 2) || '{}';
  els.payloadOut.textContent = currentPayload ? JSON.stringify(currentPayload, null, 2) : 'null';
}

function hydratePending() {
  const fromHash = decodeHashPayload();

  if (fromHash) {
    const stored = writePending(fromHash);

    try {
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState({}, '', url.toString());
    } catch {}

    return stored;
  }

  return readPending();
}

function fillHiddenFields(payload) {
  const p = payload || {};
  const cp = p.counterparty || {};
  const deal = p.deal || {};

  els.subjectEmail.value = p.subjectEmail || cp.email || '';
  els.source.value = p.source || deal.platform || '';
  els.proofRef.value = p.proofRef || deal.orderId || cp.orderId || '';
}

function getSubmitPayload(pending) {
  const p = pending || {};
  const cp = p.counterparty || {};
  const deal = p.deal || {};

  return {
    subject: els.subjectEmail.value.trim(),
    rating: Number(els.score.value || 0),
    comment: els.comment.value.trim() || undefined,
    proofRef: els.proofRef.value.trim() || undefined,
    source: els.source.value.trim() || undefined,
    counterparty: {
      email: cp.email || undefined,
      name: cp.name || undefined,
      phone: cp.phone || undefined,
      addressStreet: cp.addressStreet || undefined,
      addressZip: cp.addressZip || undefined,
      addressCity: cp.addressCity || undefined,
      country: cp.country || undefined,
      platform: cp.platform || deal.platform || undefined,
      orderId: cp.orderId || deal.orderId || undefined,
      itemId: cp.itemId || deal.itemId || undefined,
      title: cp.title || deal.title || undefined,
      pageUrl: cp.pageUrl || deal.pageUrl || p.pageUrl || undefined,
      amountSek: cp.amountSek ?? deal.amount ?? undefined,
    },
    deal: {
      platform: deal.platform || cp.platform || undefined,
      orderId: deal.orderId || cp.orderId || undefined,
      itemId: deal.itemId || cp.itemId || undefined,
      title: deal.title || cp.title || undefined,
      amount: deal.amount ?? cp.amountSek ?? undefined,
      currency: deal.currency || undefined,
      date: deal.date || undefined,
      dateISO: deal.dateISO || undefined,
      pageUrl: deal.pageUrl || cp.pageUrl || p.pageUrl || undefined,
    },
  };
}

function getDealStatusPayload(pending) {
  const p = pending || {};
  const cp = p.counterparty || {};
  const deal = p.deal || {};

  return {
    source: p.source || deal.platform || cp.platform || undefined,
    proofRef: p.proofRef || deal.orderId || cp.orderId || undefined,
    pageUrl: p.pageUrl || deal.pageUrl || cp.pageUrl || undefined,
    subject: p.subjectEmail || cp.email || undefined,
    counterparty: {
      email: cp.email || undefined,
      platform: cp.platform || deal.platform || undefined,
      orderId: cp.orderId || deal.orderId || undefined,
      itemId: cp.itemId || deal.itemId || undefined,
      pageUrl: cp.pageUrl || deal.pageUrl || p.pageUrl || undefined,
    },
    deal: {
      platform: deal.platform || cp.platform || undefined,
      orderId: deal.orderId || cp.orderId || undefined,
      itemId: deal.itemId || cp.itemId || undefined,
      pageUrl: deal.pageUrl || cp.pageUrl || p.pageUrl || undefined,
    },
  };
}

async function syncLocalRatedWithBackend(pending) {
  if (!pending) {
    currentBackendAlreadyRated = false;
    return;
  }

  const result = await checkDealStatus(getDealStatusPayload(pending));

  if (!result?.ok) {
    currentBackendAlreadyRated = false;
    refreshDebug(pending);
    return;
  }

  const alreadyRated = !!result?.data?.alreadyRated;
  currentBackendAlreadyRated = alreadyRated;

  if (alreadyRated) {
    markDealRated(pending);
  } else {
    removeDealRated(pending);
  }

  refreshDebug(pending);
}

function isDuplicateResult(result) {
  const msg = String(result?.error || '').toLowerCase();
  return (
    result?.status === 409 ||
    msg.includes('duplicate') ||
    (msg.includes('already') && msg.includes('rating')) ||
    (msg.includes('redan') && (msg.includes('betyg') || msg.includes('omdöme')))
  );
}

function setPayloadMode(isPayloadMode) {
  els.hubSection.classList.toggle('hidden', isPayloadMode);
  els.dealSection.classList.toggle('hidden', false);
  els.formSection.classList.toggle('hidden', false);
}

function updateLoginGate() {
  const isLoggedIn = !!(currentUser && (currentUser.email || currentUser.subjectRef || currentUser.id));

  if (!currentPending) {
    els.loginGateSection.classList.add('hidden');
    els.score.disabled = true;
    els.comment.disabled = true;
    els.submitBtn.disabled = true;
    return;
  }

  if (!isLoggedIn) {
    els.loginGateSection.classList.remove('hidden');
    els.score.disabled = true;
    els.comment.disabled = true;
    els.submitBtn.disabled = true;

    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    els.loginLinkBtn.href = `/profile.html?returnTo=${encodeURIComponent(returnTo)}`;
    return;
  }

  els.loginGateSection.classList.add('hidden');

  if (currentBackendAlreadyRated) {
    els.score.disabled = true;
    els.comment.disabled = true;
    els.submitBtn.disabled = true;
    return;
  }

  els.score.disabled = false;
  els.comment.disabled = false;
  els.submitBtn.disabled = false;
}

async function renderState(pending) {
  currentPending = pending || null;

  if (currentPending) {
    setPayloadMode(true);
    fillHiddenFields(currentPending);
    renderDeal(currentPending);
    refreshDebug(currentPending);

    await syncLocalRatedWithBackend(currentPending);
    updateLoginGate();

    if (currentBackendAlreadyRated) {
      setStatus('warn', 'status_backend_rated');
      els.submitBtn.textContent = L('submit_sent');
      return;
    }

    if (!currentUser) {
      setStatus('warn', 'status_login_required');
      return;
    }

    if (isDealRated(currentPending)) {
      setStatus('warn', 'status_local_rated');
      els.submitBtn.textContent = L('submit_anyway');
      return;
    }

    setStatus('ok', 'status_ready');
    els.submitBtn.textContent = L('submit');
    return;
  }

  currentBackendAlreadyRated = false;
  setPayloadMode(false);
  renderDeal(null);
  refreshDebug(null);
  updateLoginGate();
  setStatus('warn', 'status_hub');
  els.submitBtn.textContent = L('submit');
}

async function resolveAuthUser() {
  try {
    currentUser = await auth.getResolvedUser();
  } catch {
    currentUser = auth.getUser?.() || null;
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  const pending = hydratePending() || readPending();
  currentPending = pending || null;

  if (!pending) {
    setStatus('bad', 'status_missing_pending');
    refreshDebug(null);
    return;
  }

  await resolveAuthUser();
  await syncLocalRatedWithBackend(pending);
  updateLoginGate();

  if (currentBackendAlreadyRated) {
    setStatus('warn', 'status_backend_rated');
    return;
  }

  if (!currentUser) {
    setStatus('bad', 'status_login_required');
    return;
  }

  const subject = els.subjectEmail.value.trim();
  const score = Number(els.score.value || 0);

  if (!subject) {
    setStatus('bad', 'status_missing_subject');
    refreshDebug(pending);
    return;
  }

  if (!score) {
    setStatus('bad', 'status_missing_score');
    refreshDebug(pending);
    return;
  }

  const payload = getSubmitPayload(pending);

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = L('submit_loading');

  const result = await createRating(payload);

  if (!result?.ok) {
    if (isDuplicateResult(result)) {
      markDealRated(pending);
      currentBackendAlreadyRated = true;
      clearPending();
      els.ratingForm.reset();
      currentPending = null;
      renderDeal(null);
      refreshDebug(null);
      updateLoginGate();
      setPayloadMode(false);
      setStatus('warn', 'status_duplicate_backend');
      els.submitBtn.textContent = L('submit_sent');
    } else {
      setStatus('bad', 'status_save_failed');
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = L('submit');
      refreshDebug(pending);
    }
    return;
  }

  markDealRated(pending);
  clearPending();
  els.ratingForm.reset();
  currentPending = null;
  currentBackendAlreadyRated = false;
  renderDeal(null);
  refreshDebug(null);
  updateLoginGate();
  setPayloadMode(false);
  setStatus('ok', 'status_saved');
  els.submitBtn.textContent = L('submit_sent');
}

function handleOpenPlatform() {
  const selected = normalizeLower(els.platformSelect.value);

  if (!selected) {
    setStatus('warn', 'status_choose_platform');
    return;
  }

  const url = PLATFORM_LINKS[selected];
  if (!url) {
    setStatus('warn', 'status_choose_platform');
    return;
  }

  window.open(url, '_blank', 'noopener');
}

function applyStaticCopy() {
  document.title = L('page_title');

  els.heroKicker.textContent = L('hero_kicker');
  els.heroTitle.textContent = L('hero_title');
  els.heroLead.textContent = L('hero_lead');
  els.platformSelectLabel.textContent = L('platform_select_label');
  els.platformSelectPlaceholder.textContent = L('platform_select_placeholder');
  els.openPlatformBtn.textContent = L('platform_open');
  els.hubFootNote.textContent = L('hub_foot');

  els.sideTitle1.textContent = L('side_title_1');
  els.sideBody1.textContent = L('side_body_1');
  els.sideTitle2.textContent = L('side_title_2');
  els.sideBody2.textContent = L('side_body_2');

  els.statusTitle.textContent = L('status_title');
  els.verifiedTitle.textContent = L('verified_title');
  els.formTitle.textContent = L('form_title');
  els.formFootNote.textContent = L('form_foot');

  els.loginGateTitle.textContent = L('login_gate_title');
  els.loginGateLead.textContent = L('login_gate_lead');
  els.loginLinkBtn.textContent = L('login_btn');
  els.signupLinkBtn.textContent = L('signup_btn');

  els.scoreLabel.textContent = L('score_label');
  els.scorePlaceholder.textContent = L('score_placeholder');
  els.scoreOpt1.textContent = L('score_1');
  els.scoreOpt2.textContent = L('score_2');
  els.scoreOpt3.textContent = L('score_3');
  els.scoreOpt4.textContent = L('score_4');
  els.scoreOpt5.textContent = L('score_5');
  els.commentLabel.textContent = L('comment_label');
  els.comment.placeholder = L('comment_ph');

  els.reloadBtn.textContent = L('reload');
  els.clearBtn.textContent = L('clear_pending');
  els.clearRatedBtn.textContent = L('clear_rated');

  els.debugTitle.textContent = L('debug_title');
  els.debugDealKeyLabel.textContent = L('debug_deal_key');
  els.debugRatedLabel.textContent = L('debug_rated');
  els.debugPayloadLabel.textContent = L('debug_payload');
  els.debugBackendRatedLabel.textContent = L('debug_backend_rated');
}

function reRenderForLanguage() {
  applyStaticCopy();

  if (lastStatus?.key) {
    els.statusBox.className = `notice ${lastStatus.kind}`;
    els.statusBox.textContent = L(lastStatus.key);
  }

  renderDeal(currentPending);
  refreshDebug(currentPending);
  updateLoginGate();

  if (currentPending && currentUser && !currentBackendAlreadyRated) {
    els.submitBtn.textContent = isDealRated(currentPending) ? L('submit_anyway') : L('submit');
  } else if (currentBackendAlreadyRated) {
    els.submitBtn.textContent = L('submit_sent');
  } else {
    els.submitBtn.textContent = L('submit');
  }
}

function bindEvents() {
  els.ratingForm.addEventListener('submit', handleSubmit);
  els.openPlatformBtn.addEventListener('click', handleOpenPlatform);

  els.reloadBtn.addEventListener('click', async () => {
    await resolveAuthUser();
    const pending = hydratePending() || readPending();
    await renderState(pending);
  });

  els.clearBtn.addEventListener('click', async () => {
    clearPending();
    els.ratingForm.reset();
    currentPending = null;
    currentBackendAlreadyRated = false;
    await resolveAuthUser();
    await renderState(null);
    setStatus('warn', 'status_pending_cleared');
  });

  els.clearRatedBtn.addEventListener('click', async () => {
    clearRatedCache();
    const pending = hydratePending() || readPending();
    await resolveAuthUser();
    await renderState(pending);

    if (pending) {
      setStatus('ok', 'status_rated_cleared');
    } else {
      setStatus('ok', 'status_rated_cleared_no_pending');
    }
  });

  window.addEventListener('peerrate:language-changed', () => {
    reRenderForLanguage();
  });

  window.addEventListener('storage', async () => {
    await resolveAuthUser();
    updateLoginGate();
    refreshDebug(currentPending);
  });
}

function collectEls() {
  els.hubSection = $('hubSection');
  els.heroKicker = $('heroKicker');
  els.heroTitle = $('heroTitle');
  els.heroLead = $('heroLead');
  els.platformSelectLabel = $('platformSelectLabel');
  els.platformSelect = $('platformSelect');
  els.platformSelectPlaceholder = $('platformSelectPlaceholder');
  els.openPlatformBtn = $('openPlatformBtn');
  els.hubFootNote = $('hubFootNote');
  els.sideTitle1 = $('sideTitle1');
  els.sideBody1 = $('sideBody1');
  els.sideTitle2 = $('sideTitle2');
  els.sideBody2 = $('sideBody2');

  els.statusTitle = $('statusTitle');
  els.statusBox = $('statusBox');

  els.dealSection = $('dealSection');
  els.verifiedTitle = $('verifiedTitle');
  els.dealHeadTitle = $('dealHeadTitle');
  els.dealHeadSub = $('dealHeadSub');
  els.platformLogo = $('platformLogo');
  els.platformChip = $('platformChip');
  els.dealGrid = $('dealGrid');

  els.loginGateSection = $('loginGateSection');
  els.loginGateTitle = $('loginGateTitle');
  els.loginGateLead = $('loginGateLead');
  els.loginLinkBtn = $('loginLinkBtn');
  els.signupLinkBtn = $('signupLinkBtn');

  els.formSection = $('formSection');
  els.formTitle = $('formTitle');
  els.formFootNote = $('formFootNote');
  els.scoreLabel = $('scoreLabel');
  els.scorePlaceholder = $('scorePlaceholder');
  els.scoreOpt1 = $('scoreOpt1');
  els.scoreOpt2 = $('scoreOpt2');
  els.scoreOpt3 = $('scoreOpt3');
  els.scoreOpt4 = $('scoreOpt4');
  els.scoreOpt5 = $('scoreOpt5');
  els.commentLabel = $('commentLabel');

  els.debugCard = $('debugCard');
  els.debugTitle = $('debugTitle');
  els.debugDealKeyLabel = $('debugDealKeyLabel');
  els.debugRatedLabel = $('debugRatedLabel');
  els.debugPayloadLabel = $('debugPayloadLabel');
  els.debugBackendRatedLabel = $('debugBackendRatedLabel');

  els.hrefOut = $('hrefOut');
  els.hashOut = $('hashOut');
  els.dealKeyOut = $('dealKeyOut');
  els.ratedOut = $('ratedOut');
  els.backendRatedOut = $('backendRatedOut');
  els.lsOut = $('lsOut');
  els.ratedCacheOut = $('ratedCacheOut');
  els.payloadOut = $('payloadOut');

  els.reloadBtn = $('reloadBtn');
  els.clearBtn = $('clearBtn');
  els.clearRatedBtn = $('clearRatedBtn');

  els.ratingForm = $('ratingForm');
  els.subjectEmail = $('ratedUserEmail');
  els.source = $('ratingSource');
  els.proofRef = $('proofRef');
  els.score = $('score');
  els.comment = $('comment');
  els.submitBtn = $('submitBtn');
}

async function boot() {
  collectEls();

  if (els.debugCard) {
    els.debugCard.hidden = !shouldShowDebug();
  }

  applyStaticCopy();
  bindEvents();

  await resolveAuthUser();

  const pending = hydratePending();
  await renderState(pending);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}