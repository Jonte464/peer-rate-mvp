// frontend/js/rate-core.js
// Minimal kärna för rate-sidan.
// Ansvar:
// - läsa payload från #pr=...
// - spara/läsa localStorage
// - rendera verifierad affär
// - hantera formulär
// - skicka rating till backend

import { createRating } from './rate-api.js';

const PENDING_KEY = 'peerrate_pending_rating_v6';
const RATED_CACHE_KEY = 'peerrate_rated_deals_v1';
const PENDING_TTL_MS = 1000 * 60 * 60 * 24;
const RATED_TTL_MS = 1000 * 60 * 60 * 24 * 90;

const els = {};

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

  return normalizeText(source);
}

function normalizeIncoming(inObj) {
  const obj = inObj && typeof inObj === 'object' ? { ...inObj } : {};
  const deal = obj.deal && typeof obj.deal === 'object' ? { ...obj.deal } : {};
  const cp = obj.counterparty && typeof obj.counterparty === 'object' ? { ...obj.counterparty } : {};

  const out = {
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

  return out;
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

function cleanupRatedCache() {
  const cache = readRatedCache();
  const t = now();

  for (const k of Object.keys(cache)) {
    const ts = Number(cache[k] || 0);
    if (!ts || t - ts > RATED_TTL_MS) {
      delete cache[k];
    }
  }

  writeRatedCache(cache);
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

function setStatus(kind, text) {
  els.statusBox.className = `notice ${kind}`;
  els.statusBox.textContent = text;
}

function renderField(label, value) {
  return `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value || '–')}</div>
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

function renderDeal(payload) {
  if (!payload) {
    els.dealGrid.innerHTML = `
      <div class="field" style="grid-column:1/-1;">
        <div class="label">Status</div>
        <div class="value">Ingen verifierad affär hittades.</div>
      </div>
    `;
    return;
  }

  const p = payload;
  const cp = p.counterparty || {};
  const deal = p.deal || {};

  els.dealGrid.innerHTML = [
    renderField('Källa', p.source || deal.platform || ''),
    renderField('ProofRef', p.proofRef || ''),
    renderField('Order ID', deal.orderId || cp.orderId || ''),
    renderField('Item ID', deal.itemId || cp.itemId || ''),
    renderField('Motpart e-post', p.subjectEmail || cp.email || ''),
    renderField('Namn', cp.name || ''),
    renderField('Telefon', cp.phone || ''),
    renderField('Adress', formatAddress(cp)),
    renderField('Titel', deal.title || cp.title || ''),
    renderField('Belopp', formatAmount(p)),
    renderField('Datum', deal.date || deal.dateISO || ''),
    renderField('Sidlänk', p.pageUrl || deal.pageUrl || cp.pageUrl || ''),
  ].join('');
}

function refreshDebug(payload) {
  els.hrefOut.textContent = window.location.href || '';
  els.hashOut.textContent = window.location.hash || '';
  els.lsOut.textContent = localStorage.getItem(PENDING_KEY) || 'null';
  els.payloadOut.textContent = payload ? JSON.stringify(payload, null, 2) : 'null';
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

function setFormEnabled(enabled) {
  els.score.disabled = !enabled;
  els.comment.disabled = !enabled;
  els.submitBtn.disabled = !enabled;
}

function fillHiddenFields(payload) {
  const p = payload || {};
  const cp = p.counterparty || {};
  const deal = p.deal || {};

  els.subjectEmail.value = p.subjectEmail || cp.email || '';
  els.source.value = p.source || deal.platform || '';
  els.proofRef.value = p.proofRef || deal.orderId || cp.orderId || '';
}

function getSubmitPayload(currentPending) {
  const p = currentPending || {};
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

function isDuplicateResult(result) {
  const msg = String(result?.error || '').toLowerCase();
  return (
    result?.status === 409 ||
    msg.includes('duplicate') ||
    (msg.includes('already') && msg.includes('rating')) ||
    (msg.includes('redan') && (msg.includes('betyg') || msg.includes('omdöme')))
  );
}

async function handleSubmit(e) {
  e.preventDefault();

  const currentPending = hydratePending() || readPending();
  if (!currentPending) {
    setStatus('bad', 'Ingen verifierad affär finns att skicka.');
    return;
  }

  const subject = els.subjectEmail.value.trim();
  const score = Number(els.score.value || 0);

  if (!subject) {
    setStatus('bad', 'Motpartens e-post saknas.');
    return;
  }

  if (!score) {
    setStatus('bad', 'Välj ett betyg innan du skickar.');
    return;
  }

  const payload = getSubmitPayload(currentPending);

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = 'Skickar…';

  const result = await createRating(payload);

  if (!result?.ok) {
    if (isDuplicateResult(result)) {
      markDealRated(currentPending);
      clearPending();
      renderDeal(null);
      refreshDebug(null);
      setFormEnabled(false);
      setStatus('warn', 'Den här affären verkar redan vara betygsatt.');
    } else {
      setStatus('bad', result?.error || 'Kunde inte skicka omdömet.');
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = 'Skicka omdöme';
    }
    return;
  }

  markDealRated(currentPending);
  clearPending();
  els.ratingForm.reset();
  renderDeal(null);
  refreshDebug(null);
  setFormEnabled(false);
  setStatus('ok', 'Tack! Ditt omdöme är sparat.');
  els.submitBtn.textContent = 'Skickat';
}

function bindEvents() {
  els.reloadBtn.addEventListener('click', () => {
    const p = hydratePending() || readPending();
    renderDeal(p);
    refreshDebug(p);

    if (p && !isDealRated(p)) {
      fillHiddenFields(p);
      setFormEnabled(true);
      setStatus('ok', 'Verifierad affär laddad.');
      els.submitBtn.textContent = 'Skicka omdöme';
    } else if (p && isDealRated(p)) {
      setFormEnabled(false);
      setStatus('warn', 'Den här affären är redan markerad som betygsatt lokalt.');
    } else {
      setFormEnabled(false);
      setStatus('warn', 'Ingen payload hittades i hash eller localStorage.');
    }
  });

  els.clearBtn.addEventListener('click', () => {
    clearPending();
    renderDeal(null);
    refreshDebug(null);
    setFormEnabled(false);
    setStatus('warn', 'Pending payload rensad.');
    els.submitBtn.textContent = 'Skicka omdöme';
  });

  els.ratingForm.addEventListener('submit', handleSubmit);
}

function collectEls() {
  els.statusBox = $('statusBox');
  els.dealGrid = $('dealGrid');
  els.hrefOut = $('hrefOut');
  els.hashOut = $('hashOut');
  els.lsOut = $('lsOut');
  els.payloadOut = $('payloadOut');
  els.reloadBtn = $('reloadBtn');
  els.clearBtn = $('clearBtn');

  els.ratingForm = $('ratingForm');
  els.subjectEmail = $('ratedUserEmail');
  els.source = $('ratingSource');
  els.proofRef = $('proofRef');
  els.score = $('score');
  els.comment = $('comment');
  els.submitBtn = $('submitBtn');
}

function boot() {
  collectEls();
  bindEvents();

  const pending = hydratePending();

  if (pending && isDealRated(pending)) {
    renderDeal(pending);
    refreshDebug(pending);
    fillHiddenFields(pending);
    setFormEnabled(false);
    setStatus('warn', 'Den här affären är redan markerad som betygsatt lokalt.');
    return;
  }

  if (pending) {
    renderDeal(pending);
    refreshDebug(pending);
    fillHiddenFields(pending);
    setFormEnabled(true);
    setStatus('ok', 'Verifierad affär laddad och redo att betygsättas.');
    return;
  }

  renderDeal(null);
  refreshDebug(null);
  setFormEnabled(false);
  setStatus('warn', 'Ingen payload hittades i hash eller localStorage.');
}

window.addEventListener('DOMContentLoaded', boot);