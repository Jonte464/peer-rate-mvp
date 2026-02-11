// frontend/modules/ratingForm.js
import { showNotification } from './utils.js';
import auth, { login } from './auth.js';
import api from './api.js';

const PENDING_KEY = 'peerrate_pending_rating_v2';
const TTL_MS = 1000 * 60 * 60 * 24;

function now() { return Date.now(); }
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

/**
 * Robust base64->json:
 * - Stöd för äldre payload: btoa(JSON.stringify(obj))
 * - Stöd för UTF-8-säker variant: btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
 */
function readB64Json(b64) {
  if (!b64) return null;
  try {
    const cleaned = decodeURIComponent(b64);

    // 1) testa "vanlig" atob först
    try {
      const raw = atob(cleaned);
      const j = safeParse(raw);
      if (j && typeof j === 'object') return j;
    } catch {}

    // 2) testa UTF-8-variant
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

function setPending(data) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...data, _ts: now() })); } catch {}
}

function getPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!parsed) return null;
    if (now() - (parsed._ts || 0) > TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

function isRatePage() {
  return (window.location.pathname || '').toLowerCase().includes('/rate.html');
}

/** Robust: hitta login-card även om id varierar */
function getLoginCardEls() {
  return [
    document.getElementById('login-card'),
    document.getElementById('rating-login-card'),
    document.getElementById('rating-login'),
    document.querySelector('[data-role="rating-login"]'),
  ].filter(Boolean);
}

/** Robust: hitta alla tänkbara wrappers för rating-form */
function getRatingWrapperEls() {
  return [
    document.getElementById('rating-form-wrapper'),
    document.getElementById('rating-card'),
    document.getElementById('rating-form-card'),
    document.getElementById('rating-form'),
  ].filter(Boolean);
}

/** Hitta (och dölj) “Test utan inloggning” om den finns */
function hideTestWithoutLoginButton() {
  const byId =
    document.getElementById('test-without-login') ||
    document.getElementById('test-without-login-btn') ||
    document.getElementById('testWithoutLogin') ||
    document.getElementById('testWithoutLoginBtn') ||
    document.getElementById('testWithoutLoginBtn2');

  if (byId) {
    byId.style.display = 'none';
    byId.setAttribute('aria-hidden', 'true');
    return;
  }

  const btns = Array.from(document.querySelectorAll('button, a'));
  const hit = btns.find(el => (el.textContent || '').toLowerCase().includes('test utan inloggning'));
  if (hit) {
    hit.style.display = 'none';
    hit.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Bulletproof show/hide:
 * - Om element saknas: visa hellre mer än mindre (aldrig "vit" sida)
 * - Inloggad: göm login, visa rating (om rating targets finns)
 * - Utloggad: visa login, göm rating (om rating targets finns)
 *
 * OBS: På nya rate.html finns inget öppet formulär - då finns ofta inga rating targets.
 */
function setVisibility(isLoggedIn) {
  const loginCards = getLoginCardEls();
  const ratingWrappers = getRatingWrapperEls();

  const hint =
    document.getElementById('rating-login-hint') ||
    document.getElementById('ratingHint') ||
    null;

  const hasLoginTargets = loginCards.length > 0;
  const hasRatingTargets = ratingWrappers.length > 0;

  // Failsafe: om vi inte hittar något att toggla, gör inget (undvik vit sida).
  if (!hasLoginTargets && !hasRatingTargets) {
    console.warn('[PeerRate] setVisibility: no targets found; skipping toggle to avoid blank UI.');
    return;
  }

  // Om logged in men ratingWrappers saknas → visa login också (hellre dubbelt än tomt).
  const shouldShowLogin = !isLoggedIn || (!hasRatingTargets && isLoggedIn);
  const shouldShowRating = isLoggedIn && hasRatingTargets;

  // Login UI
  if (hasLoginTargets) {
    loginCards.forEach((el) => {
      el.style.display = shouldShowLogin ? 'block' : 'none';
      el.classList.toggle('hidden', !shouldShowLogin);
    });
  }

  // Hint
  if (hint) {
    hint.classList.toggle('hidden', isLoggedIn);
    hint.style.display = isLoggedIn ? 'none' : '';
  }

  // Rating UI (legacy)
  if (hasRatingTargets) {
    ratingWrappers.forEach((el) => {
      el.style.display = shouldShowRating ? 'block' : 'none';
      el.classList.toggle('hidden', !shouldShowRating);
    });
  }
}

/** ✅ Dropdown → länk ut (om du använder den på rate.html) */
export function initPlatformPicker() {
  if (!isRatePage()) return;

  const select = document.getElementById('platformSelect');
  const goBtn = document.getElementById('platformGoBtn');

  // Viktigt: din nuvarande rate.html har INTE element med id="platformInstructions".
  // Därför gör vi denna init tolerant.
  const instructions =
    document.getElementById('platformInstructions') ||
    document.getElementById('platformNote') ||
    null;

  if (!select || !goBtn) return;

  const platforms = {
    tradera: {
      label: 'Tradera',
      url: 'https://www.tradera.com/',
      tip_sv: 'Öppna ordern på Tradera. När du är på rätt sida: klicka på PeerRate-extensionen.',
      tip_en: 'Open the order on Tradera. When you are on the right page: click the PeerRate extension.'
    },
    blocket: {
      label: 'Blocket',
      url: 'https://www.blocket.se/',
      tip_sv: 'Öppna annons/profil. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open listing/profile. Click the extension to send verified info.'
    },
    airbnb: {
      label: 'Airbnb',
      url: 'https://www.airbnb.com/',
      tip_sv: 'Öppna resa/konversation. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open trip/thread. Click the extension to send verified info.'
    },
    ebay: {
      label: 'eBay',
      url: 'https://www.ebay.com/',
      tip_sv: 'Öppna order. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open order. Click the extension to send verified info.'
    },
    tiptap: {
      label: 'Tiptap',
      url: 'https://tiptapp.se/',
      tip_sv: 'Öppna relevant sida. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open relevant page. Click the extension to send verified info.'
    },
    hygglo: {
      label: 'Hygglo',
      url: 'https://www.hygglo.se/',
      tip_sv: 'Öppna bokning. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open booking. Click the extension to send verified info.'
    },
    husknuten: {
      label: 'Husknuten',
      url: 'https://husknuten.se/',
      tip_sv: 'Öppna bokning. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open booking. Click the extension to send verified info.'
    },
    facebook_marketplace: {
      label: 'Facebook Marketplace',
      url: 'https://www.facebook.com/marketplace/',
      tip_sv: 'Öppna annons/konversation. Klicka extensionen för att skicka verifierad info.',
      tip_en: 'Open listing/thread. Click the extension to send verified info.'
    },
  };

  function getLang() {
    return (document.documentElement.lang || 'sv').toLowerCase().startsWith('en') ? 'en' : 'sv';
  }

  function setGoEnabled(enabled) {
    // din button är <button>, inte <a>
    goBtn.disabled = !enabled;
    goBtn.style.pointerEvents = enabled ? 'auto' : 'none';
    goBtn.style.opacity = enabled ? '1' : '.55';
  }

  function renderTip(key) {
    const p = platforms[key];
    if (!p || !instructions) return;
    const lang = getLang();
    const tip = (lang === 'en') ? (p.tip_en || '') : (p.tip_sv || '');
    // instructions kan vara ett helt block — vi skriver bara en kort text
    instructions.textContent = tip;
  }

  function onSelect() {
    const key = select.value || '';
    const p = platforms[key];

    if (!p) {
      setGoEnabled(false);
      return;
    }

    setGoEnabled(true);
    renderTip(key);
  }

  // Preselect via query (?source=airbnb etc)
  const qs = new URLSearchParams(window.location.search || '');
  const sourceRaw = (qs.get('source') || '').trim().toLowerCase();

  const sourceMap = {
    tradera: 'tradera',
    blocket: 'blocket',
    airbnb: 'airbnb',
    ebay: 'ebay',
    tiptap: 'tiptap',
    tiptapp: 'tiptap',
    hygglo: 'hygglo',
    husknuten: 'husknuten',
    facebook: 'facebook_marketplace',
    marketplace: 'facebook_marketplace',
    'facebook marketplace': 'facebook_marketplace'
  };

  const pending = getPending();
  const pendingSource = (pending?.source || '').toString().trim().toLowerCase();

  const resolved =
    sourceMap[sourceRaw] ||
    sourceMap[pendingSource] ||
    '';

  if (resolved && platforms[resolved]) {
    select.value = resolved;
  }

  setGoEnabled(false);
  onSelect();
  select.addEventListener('change', onSelect);

  // Öppna plattform
  goBtn.addEventListener('click', () => {
    const key = (select.value || '').trim();
    const p = platforms[key];
    if (!p) return;
    window.open(p.url, '_blank', 'noopener,noreferrer');
  });

  // Uppdatera tip vid språkbyte
  const mo = new MutationObserver(() => {
    const key = select.value || '';
    if (platforms[key]) renderTip(key);
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}

/**
 * Normalisera payload från extension/query till ett internt "pending"-format
 * så resten av UI alltid kan utgå från samma fält.
 */
function normalizeIncoming(inObj) {
  const obj = (inObj && typeof inObj === 'object') ? { ...inObj } : {};
  const out = { ...obj };

  // source/pageUrl/proofRef
  out.source = out.source || obj.source || '';
  out.pageUrl = out.pageUrl || obj.pageUrl || '';

  // Stöd för nya payloaden: { deal: { ... , counterparty: { email/username/name } } }
  const deal = obj.deal || obj.counterparty?.deal || null;
  const cp = (deal && deal.counterparty) ? deal.counterparty : (obj.counterparty || null);

  // subjectEmail: primärt cp.email
  out.subjectEmail =
    obj.subjectEmail ||
    cp?.email ||
    obj.subject ||
    '';

  // counterparty: håll en tydlig struktur
  out.counterparty = {
    ...(obj.counterparty && typeof obj.counterparty === 'object' ? obj.counterparty : {}),
    ...(cp && typeof cp === 'object' ? cp : {}),
  };

  // dealinfo (om finns)
  out.deal = deal && typeof deal === 'object' ? deal : (obj.deal || undefined);

  // proofRef: helst orderId, annars proofRef, annars pageUrl
  out.proofRef =
    obj.proofRef ||
    deal?.orderId ||
    obj.counterparty?.orderId ||
    out.pageUrl ||
    '';

  // Källa-presentation: om source är "tradera" gör vi "Tradera"
  const s = String(out.source || '').toLowerCase();
  if (s === 'tradera') out.source = 'Tradera';

  return out;
}

/**
 * Visa "Verifierad källa" kortet från pending, om det finns.
 */
function applyPendingContextCard(p) {
  if (!p) return;

  const ctxCard = document.getElementById('rate-context-card');
  const ctxSource = document.getElementById('rate-context-source');
  const ctxLink = document.getElementById('rate-context-link');

  if (ctxCard) ctxCard.style.display = '';
  if (ctxSource) ctxSource.textContent = (p.source || '–');

  if (ctxLink && p.pageUrl) {
    ctxLink.href = p.pageUrl;
    ctxLink.style.display = '';
  } else if (ctxLink) {
    ctxLink.style.display = 'none';
  }
}

/**
 * Rendera en "Verifierad affär" i listan + skapa låst rating-form om inloggad.
 */
function renderVerifiedDealUI(p) {
  if (!isRatePage()) return;

  const emptyEl = document.getElementById('verified-empty');
  const listEl = document.getElementById('verified-list');

  if (!emptyEl || !listEl) return;

  // saknas pending eller saknas identifierare -> visa tomt läge
  const hasAnything = !!(p?.proofRef || p?.pageUrl || p?.subjectEmail || p?.counterparty?.email || p?.counterparty?.username);
  if (!p || !hasAnything) {
    emptyEl.style.display = '';
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    removeLockedFormCard();
    return;
  }

  // visa list
  emptyEl.style.display = 'none';
  listEl.style.display = '';
  listEl.innerHTML = '';

  const cpEmail = p.subjectEmail || p?.counterparty?.email || '';
  const cpUser = p?.counterparty?.username || '';
  const deal = p.deal || {};
  const orderId = deal.orderId || p.proofRef || '';
  const amount = (deal.amount != null) ? deal.amount : (deal.amountSek != null ? deal.amountSek : null);
  const currency = deal.currency || (amount != null ? 'SEK' : '');
  const date = deal.date || deal.dateISO || '';

  const card = document.createElement('div');
  card.style.border = '1px solid rgba(0,0,0,.08)';
  card.style.background = '#fff';
  card.style.borderRadius = '14px';
  card.style.padding = '12px';

  const left = document.createElement('div');
  left.style.display = 'grid';
  left.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  left.style.gap = '10px';

  left.innerHTML = `
    <div>
      <div style="font-size:12px;color:var(--pr-muted);">Källa</div>
      <div style="font-weight:900;">${escapeHtml(p.source || '–')}</div>
    </div>
    <div>
      <div style="font-size:12px;color:var(--pr-muted);">Proof</div>
      <div style="font-weight:900;word-break:break-word;">${escapeHtml(orderId || '–')}</div>
    </div>
    <div>
      <div style="font-size:12px;color:var(--pr-muted);">Motpart</div>
      <div style="font-weight:900;word-break:break-word;">
        ${escapeHtml(cpEmail || cpUser || '–')}
      </div>
    </div>
    <div>
      <div style="font-size:12px;color:var(--pr-muted);">Belopp / Datum</div>
      <div style="font-weight:900;">
        ${amount != null ? `${escapeHtml(String(amount))} ${escapeHtml(currency || '')}` : '–'}
        ${date ? ` • ${escapeHtml(date)}` : ''}
      </div>
    </div>
  `;

  const actions = document.createElement('div');
  actions.style.marginTop = '10px';
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.flexWrap = 'wrap';
  actions.style.alignItems = 'center';

  const link = document.createElement('a');
  link.href = p.pageUrl || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Visa källan →';
  link.style.fontWeight = '800';
  link.style.textDecoration = 'none';
  link.style.color = '#1d4ed8';
  link.style.display = p.pageUrl ? 'inline-block' : 'none';

  actions.appendChild(link);

  card.appendChild(left);
  card.appendChild(actions);
  listEl.appendChild(card);

  // Skapa låst betygsform (Steg 3) när användaren är inloggad
  const user = auth.getUser?.() || null;
  if (user) {
    ensureLockedFormCard(p, user);
  } else {
    // utloggad: ta bort form (om den finns) – användaren ska logga in först
    removeLockedFormCard();
  }
}

function ensureLockedFormCard(p, user) {
  // Finns redan?
  if (document.getElementById('locked-rating-card')) {
    // uppdatera ev visade fält
    updateLockedFormWithPending(p, user);
    return;
  }

  const anchor = document.getElementById('verified-deals-card') || document.getElementById('rate-context-card');
  if (!anchor || !anchor.parentElement) return;

  const card = document.createElement('section');
  card.className = 'pr-card';
  card.id = 'locked-rating-card';
  card.style.marginBottom = '16px';

  card.innerHTML = `
    <h2 style="margin:0 0 8px;">Steg 3: Lämna omdöme</h2>
    <p style="margin:0 0 12px;color:var(--pr-muted);font-size:13px;line-height:1.55;">
      Formuläret är låst till verifierad affär. Du kan bara välja betyg och skriva kommentar.
    </p>

    <div id="locked-meta" style="border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:14px;padding:12px;margin-bottom:12px;"></div>

    <form id="locked-rating-form" autocomplete="off">
      <input type="hidden" name="ratedUserEmail" />
      <input type="hidden" name="source" />
      <input type="hidden" name="proofRef" />
      <input type="hidden" name="rater" />

      <div class="pr-field">
        <label class="pr-label" for="locked-score">Betyg</label>
        <select class="pr-select" id="locked-score" name="score" required>
          <option value="" selected>Välj…</option>
          <option value="1">1 – Mycket dåligt</option>
          <option value="2">2 – Dåligt</option>
          <option value="3">3 – Okej</option>
          <option value="4">4 – Bra</option>
          <option value="5">5 – Mycket bra</option>
        </select>
      </div>

      <div class="pr-field">
        <label class="pr-label" for="locked-comment">Kommentar (valfritt)</label>
        <textarea class="pr-textarea" id="locked-comment" name="comment" rows="4"
          placeholder="Vad fungerade bra/dåligt?"></textarea>
      </div>

      <div class="pr-actions">
        <button class="pr-btn pr-btn-primary" type="submit">Skicka omdöme</button>
      </div>

      <p id="locked-notice" style="margin-top:10px;color:var(--pr-muted);font-size:12px;"></p>
    </form>
  `;

  // Placera efter verifierade affärer-kortet
  anchor.parentElement.insertBefore(card, anchor.nextSibling);

  // bind submit
  const form = document.getElementById('locked-rating-form');
  if (form) {
    form.addEventListener('submit', handleLockedSubmit);
  }

  updateLockedFormWithPending(p, user);
}

function removeLockedFormCard() {
  const el = document.getElementById('locked-rating-card');
  if (el) el.remove();
}

function updateLockedFormWithPending(p, user) {
  const meta = document.getElementById('locked-meta');
  const form = document.getElementById('locked-rating-form');
  if (!meta || !form) return;

  const deal = p.deal || {};
  const cpEmail = p.subjectEmail || p?.counterparty?.email || '';
  const cpUser = p?.counterparty?.username || '';
  const orderId = deal.orderId || p.proofRef || '';
  const amount = (deal.amount != null) ? deal.amount : (deal.amountSek != null ? deal.amountSek : null);
  const currency = deal.currency || (amount != null ? 'SEK' : '');
  const date = deal.date || deal.dateISO || '';

  meta.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Motpart</div>
        <div style="font-weight:900;word-break:break-word;">${escapeHtml(cpEmail || cpUser || '–')}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Källa</div>
        <div style="font-weight:900;">${escapeHtml(p.source || '–')}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Order/Proof</div>
        <div style="font-weight:900;word-break:break-word;">${escapeHtml(orderId || '–')}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--pr-muted);">Belopp / Datum</div>
        <div style="font-weight:900;">
          ${amount != null ? `${escapeHtml(String(amount))} ${escapeHtml(currency || '')}` : '–'}
          ${date ? ` • ${escapeHtml(date)}` : ''}
        </div>
      </div>
    </div>
  `;

  // Hidden fields (låsning)
  form.querySelector('input[name="ratedUserEmail"]').value = cpEmail || '';
  form.querySelector('input[name="source"]').value = p.source || '';
  form.querySelector('input[name="proofRef"]').value = p.proofRef || '';
  form.querySelector('input[name="rater"]').value = user?.email || '';
}

async function handleLockedSubmit(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const user = auth.getUser?.() || null;
  if (!user) {
    showNotification('error', 'Du måste logga in för att skicka omdöme.', 'locked-notice');
    return;
  }

  const subjectEmail = form.querySelector('input[name="ratedUserEmail"]')?.value?.trim() || '';
  const score = Number(form.querySelector('select[name="score"]')?.value || 0);
  const comment = form.querySelector('textarea[name="comment"]')?.value?.trim() || '';
  const proofRef = form.querySelector('input[name="proofRef"]')?.value?.trim() || '';
  const sourceRaw = form.querySelector('input[name="source"]')?.value?.trim() || '';
  const raterVal = form.querySelector('input[name="rater"]')?.value?.trim() || user.email;

  if (!subjectEmail) {
    showNotification('error', 'Motpart saknas i verifierad affär.', 'locked-notice');
    return;
  }
  if (!score) {
    showNotification('error', 'Välj ett betyg.', 'locked-notice');
    return;
  }

  const pending = getPending();
  const counterparty = pending?.counterparty || pending?.deal?.counterparty || null;
  const deal = pending?.deal || null;

  const payload = {
    subject: subjectEmail,
    rating: Number(score),
    rater: raterVal || undefined,
    comment: comment || undefined,
    proofRef: proofRef || undefined,
    source: sourceRaw || undefined,
    counterparty: counterparty || undefined,
    deal: deal || undefined, // om backend ignorerar ok; annars bra för framtiden
  };

  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const result = await api.createRating(payload);
    if (!result || result.ok === false) {
      showNotification('error', result?.error || 'Kunde inte spara betyget.', 'locked-notice');
      if (btn) btn.disabled = false;
      return;
    }

    clearPending();
    showNotification('success', 'Tack! Ditt omdöme är sparat.', 'locked-notice');
    form.reset();
    removeLockedFormCard();

    // återställ listan
    renderVerifiedDealUI(getPending());
    if (btn) btn.disabled = false;
  } catch (err) {
    console.error('locked submit error', err);
    showNotification('error', 'Tekniskt fel. Försök igen om en stund.', 'locked-notice');
    if (btn) btn.disabled = false;
  }
}

/**
 * Läs query och skriv pending.
 * Stöd:
 * - ?pr= (payload)
 * - ?source=&pageUrl=&proofRef=
 */
function captureFromUrl() {
  const qs = new URLSearchParams(window.location.search || '');
  const pr = qs.get('pr');
  const source = qs.get('source') || '';
  const pageUrl = qs.get('pageUrl') || '';
  const proofRef = qs.get('proofRef') || '';

  if (!pr && !source && !pageUrl && !proofRef) return null;

  if (pr) {
    const decoded = readB64Json(pr);
    if (decoded && typeof decoded === 'object') {
      // fyll från query om saknas
      if (!decoded.source && source) decoded.source = source;
      if (!decoded.pageUrl && pageUrl) decoded.pageUrl = pageUrl;
      if (!decoded.proofRef && proofRef) decoded.proofRef = proofRef;

      const normalized = normalizeIncoming(decoded);
      setPending(normalized);
      return normalized;
    }
  }

  // inga pr-data, men query har source/pageUrl
  const existing = getPending() || {};
  const merged = normalizeIncoming({
    ...existing,
    source: source || existing.source,
    pageUrl: pageUrl || existing.pageUrl,
    proofRef: proofRef || existing.proofRef,
  });

  setPending(merged);
  return merged;
}

function initPlatformStarter() {
  const select = document.getElementById('platformSelect');
  const btn = document.getElementById('platformGoBtn');
  if (!select || !btn) return;

  const platforms = {
    tradera:  { label: 'Tradera', url: 'https://www.tradera.com/' },
    blocket:  { label: 'Blocket', url: 'https://www.blocket.se/' },
    airbnb:   { label: 'Airbnb',  url: 'https://www.airbnb.com/' },
    ebay:     { label: 'eBay',    url: 'https://www.ebay.com/' },
    tiptap:   { label: 'Tiptap',  url: 'https://www.tiptapp.se/' },
    hygglo:   { label: 'Hygglo',  url: 'https://www.hygglo.se/' },
    husknuten:{ label: 'Husknuten', url: 'https://www.husknuten.se/' },
    facebook: { label: 'Facebook Marketplace', url: 'https://www.facebook.com/marketplace/' },
  };

  const syncBtn = () => {
    const key = (select.value || '').trim();
    btn.disabled = !key || !platforms[key];
  };

  select.addEventListener('change', () => {
    const key = (select.value || '').trim();
    if (key && platforms[key]) {
      const existing = getPending() || {};
      setPending({ ...existing, source: platforms[key].label });
      // rendera om UI
      const p = getPending();
      applyPendingContextCard(p);
      renderVerifiedDealUI(p);
    }
    syncBtn();
  });

  btn.addEventListener('click', () => {
    const key = (select.value || '').trim();
    const p = platforms[key];
    if (!p) return;
    window.open(p.url, '_blank', 'noopener,noreferrer');
  });

  syncBtn();
}

/**
 * Legacy: initRatingLogin har tidigare också initat öppet betygsform.
 * Nu använder vi den främst för login + pending + render av verifierad affär.
 */
export function initRatingLogin() {
  hideTestWithoutLoginButton();
  initPlatformStarter();

  // 1) pending från URL
  const fromUrl = captureFromUrl();
  const pending = fromUrl || getPending();

  if (pending) {
    applyPendingContextCard(pending);
    renderVerifiedDealUI(pending);
  } else {
    renderVerifiedDealUI(null);
  }

  // 2) bind login
  const loginForm = document.getElementById('rating-login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  // 3) sätt UI direkt baserat på session
  const user = auth.getUser?.() || null;
  setVisibility(!!user);

  // 4) om login/logout sker i annan flik
  window.addEventListener('storage', () => {
    const u2 = auth.getUser?.() || null;
    setVisibility(!!u2);

    const p2 = getPending();
    if (p2) {
      applyPendingContextCard(p2);
      renderVerifiedDealUI(p2);
    } else {
      renderVerifiedDealUI(null);
    }
  });
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;

  const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
  const password = form.querySelector('input[name="password"]')?.value || '';

  if (!email || !password) {
    showNotification('error', 'Fyll i både e-post och lösenord.', 'login-status');
    return;
  }

  try {
    const res = await login(email, password);
    if (!res || res.ok === false) {
      showNotification('error', res?.error || 'Login failed.', 'login-status');
      return;
    }

    showNotification('success', 'Du är nu inloggad.', 'login-status');

    // På rate.html: stanna, göm login, visa låst form om pending finns
    if (isRatePage()) {
      setVisibility(true);

      const p = getPending();
      if (p) {
        applyPendingContextCard(p);
        renderVerifiedDealUI(p);
      }
      return;
    }

    // Annars: till profil
    window.setTimeout(() => {
      window.location.href = '/profile.html';
    }, 150);

  } catch (err) {
    console.error('login error', err);
    showNotification('error', 'Tekniskt fel vid inloggning.', 'login-status');
  }
}

/**
 * Legacy: om du har andra sidor som fortfarande använder ett öppet rating-form.
 * Vi lämnar kvar dessa exports för kompatibilitet.
 */
export function initRatingForm() {
  const form = document.getElementById('rating-form');
  if (!form) return;

  if (form.dataset.ratingBound === '1') return;
  form.dataset.ratingBound = '1';

  form.addEventListener('submit', handleSubmit);

  const resetBtn = document.getElementById('reset-form');
  if (resetBtn) resetBtn.addEventListener('click', () => form.reset());
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;

  const subjectEmail = form.querySelector('input[name="ratedUserEmail"]')?.value?.trim() || '';
  const score = Number(form.querySelector('select[name="score"]')?.value || 0);
  const comment = form.querySelector('textarea[name="comment"]')?.value?.trim() || '';
  const proofRef = form.querySelector('input[name="proofRef"]')?.value?.trim() || '';
  const sourceRaw = form.querySelector('select[name="source"]')?.value || '';

  if (!subjectEmail || !score) {
    showNotification('error', 'Fyll i alla obligatoriska fält innan du skickar.', 'notice');
    return;
  }

  const pending = getPending();
  const counterparty = pending?.counterparty || null;

  const raterVal = form.querySelector('input[name="rater"]')?.value?.trim() || null;

  const payload = {
    subject: subjectEmail,
    rating: Number(score),
    rater: raterVal || undefined,
    comment: comment || undefined,
    proofRef: proofRef || undefined,
    source: sourceRaw || undefined,
    counterparty: counterparty || undefined,
  };

  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const result = await api.createRating(payload);
    if (!result || result.ok === false) {
      showNotification('error', result?.error || 'Kunde inte spara betyget.', 'notice');
      if (btn) btn.disabled = false;
      return;
    }

    clearPending();
    showNotification('success', 'Tack för ditt omdöme!', 'notice');
    form.reset();
    if (btn) btn.disabled = false;
  } catch (err) {
    console.error('submit error', err);
    showNotification('error', 'Tekniskt fel. Försök igen om en stund.', 'notice');
    if (btn) btn.disabled = false;
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
