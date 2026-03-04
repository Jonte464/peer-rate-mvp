// frontend/modules/ratingContext.js
// Säker pending-hantering som inte kan krascha hela sajten.
// - Pending sparas per user i sessionStorage
// - Pending speglas även till localStorage (peerrate_pending_rating_v2) för ratingForm.js
// - Pending rensas när användaren byts
// - Overlay visas bara på rate.html

import auth from "./auth.js";

const LAST_USER_KEY = "peerRateLastUserKey";

// Legacy keys (från äldre kod/extension/experiment)
const LEGACY_CONTEXT_KEYS = [
  "peerRateRatingContext",
  "peerRateRateContext",
  "peerRatePrefill",
  "ratingContext",
  "rateContext",
  "peerRateDraftRating",
  "peerRatePendingRating",
  "peerRatePendingDeal",
  "peerrate_pending_rating_v2", // ratingForm.js pending key
];

// ratingForm.js läser denna:
const LEGACY_PENDING_KEY = "peerrate_pending_rating_v2";
const LEGACY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function perUserKey(base, userKey) {
  return `${base}:${userKey}`;
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function nowMs() {
  return Date.now();
}

function isRatePage() {
  const path = (window.location.pathname || "").toLowerCase();
  return path.endsWith("/rate.html") || path.includes("/rate.html");
}

function readLegacyPending() {
  try {
    const raw = localStorage.getItem(LEGACY_PENDING_KEY);
    const obj = safeJsonParse(raw);
    if (!obj || typeof obj !== "object") return null;

    const ts = Number(obj._ts || 0);
    if (ts && nowMs() - ts > LEGACY_TTL_MS) {
      localStorage.removeItem(LEGACY_PENDING_KEY);
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

// Försök hitta email även om auth.getUser() inte hunnit uppdateras ännu
function getBestEmailGuess() {
  try {
    const u = auth.getUser?.() || null;
    const emailFromAuth = (u?.email || u?.customer?.email || "").trim().toLowerCase();
    if (emailFromAuth) return emailFromAuth;

    // Fallback: leta i vanliga localStorage-nycklar
    const candidates = ["peerRateUser", "peerRateCustomer", "user", "customer"];
    for (const k of candidates) {
      const raw = localStorage.getItem(k);
      const obj = safeJsonParse(raw);
      const e = (obj?.email || obj?.customer?.email || "").trim().toLowerCase();
      if (e) return e;
    }
  } catch {}
  return "";
}

function getUserKey() {
  return getBestEmailGuess() || "anon";
}

// Spegla pending till localStorage så ratingForm.js hittar den
function writeLegacyPending(deal) {
  try {
    if (!deal || typeof deal !== "object") return;
    localStorage.setItem(
      LEGACY_PENDING_KEY,
      JSON.stringify({ ...deal, _ts: nowMs() })
    );
  } catch {}
}

function clearLegacyPending() {
  try {
    localStorage.removeItem(LEGACY_PENDING_KEY);
  } catch {}
}

function clearAllPendingEverywhere() {
  try {
    // Rensa legacy keys i både localStorage och sessionStorage
    for (const k of LEGACY_CONTEXT_KEYS) {
      try { localStorage.removeItem(k); } catch {}
      try { sessionStorage.removeItem(k); } catch {}
    }

    // Rensa ALLA per-user pending i sessionStorage
    try {
      const prefix = "peerRatePendingDeal:";
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(prefix)) sessionStorage.removeItem(key);
      }
    } catch {}

    clearLegacyPending();

    try {
      window.dispatchEvent(new CustomEvent("pr:pending-cleared"));
    } catch {}
  } catch {}
}

function readPendingDealFor(userKey) {
  try {
    const v = sessionStorage.getItem(perUserKey("peerRatePendingDeal", userKey));
    const obj = safeJsonParse(v);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

function writePendingDealFor(userKey, deal) {
  try {
    sessionStorage.setItem(
      perUserKey("peerRatePendingDeal", userKey),
      JSON.stringify(deal || {})
    );

    // spegla till localStorage för ratingForm.js
    writeLegacyPending(deal);

    try {
      window.dispatchEvent(new CustomEvent("pr:pending-updated", { detail: deal || {} }));
    } catch {}
  } catch {}
}

function clearPendingDealFor(userKey) {
  try {
    sessionStorage.removeItem(perUserKey("peerRatePendingDeal", userKey));
  } catch {}
  clearLegacyPending();
  try {
    window.dispatchEvent(new CustomEvent("pr:pending-cleared"));
  } catch {}
}

function readDealFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const source = (params.get("source") || "").trim();
    const pageUrl = (params.get("pageUrl") || "").trim();
    const proofRef = (params.get("proofRef") || "").trim();
    const pr = (params.get("pr") || "").trim();

    // om vi har pr=... så ska ratingForm.js hantera det (den har base64-decode)
    // ratingContext ska inte försöka decodea det här.
    if (!source && !pageUrl && !proofRef && !pr) return null;

    let decodedPageUrl = pageUrl;
    try {
      decodedPageUrl = pageUrl ? decodeURIComponent(pageUrl) : "";
    } catch {
      decodedPageUrl = pageUrl;
    }

    return {
      source,
      pageUrl: decodedPageUrl,
      proofRef,
      receivedAt: new Date().toISOString(),
      // vi tar med pr så ratingForm.js kan ta den om den vill
      pr: pr || undefined,
    };
  } catch {
    return null;
  }
}

function removeQueryParams() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("source");
    url.searchParams.delete("pageUrl");
    url.searchParams.delete("proofRef");
    // vi tar INTE bort pr här — ratingForm.js behöver den för decode
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeAttr(s) {
  return String(s || "").replaceAll('"', "%22");
}

function createOverlayIfNeeded(deal) {
  try {
    if (!deal) return;
    if (document.getElementById("pr-pending-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "pr-pending-overlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,.45);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 90px 16px 16px;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      width: min(820px, 100%);
      background: rgba(255,255,255,.98);
      border: 1px solid rgba(15,15,18,.10);
      border-radius: 18px;
      box-shadow: 0 30px 90px rgba(0,0,0,.20);
      padding: 16px;
    `;

    const prettySource = deal.source ? deal.source : "Okänd plattform";

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="font-weight:850; letter-spacing:-.01em; font-size:16px;">
          Du har en affär att betygsätta
        </div>
        <button id="pr-pending-close" type="button"
          style="border:1px solid rgba(0,0,0,.12); background:#fff; border-radius:999px; padding:8px 12px; font-weight:750; cursor:pointer;">
          Inte nu
        </button>
      </div>

      <div style="margin-top:10px; font-size:13px; opacity:.75; line-height:1.5;">
        <div><b>Plattform:</b> ${escapeHtml(prettySource)}</div>
        ${deal.proofRef ? `<div><b>Referens:</b> ${escapeHtml(deal.proofRef)}</div>` : ""}
        ${deal.pageUrl ? `<div style="margin-top:6px;"><a href="${escapeAttr(deal.pageUrl)}" target="_blank" rel="noreferrer"
           style="color:inherit; text-decoration:underline;">Öppna affären</a></div>` : ""}
        <div style="margin-top:8px;">
          För att fortsätta behöver du antingen <b>skriva omdöme</b> eller <b>rensa affärsdata</b>.
        </div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
        <button id="pr-pending-go" type="button"
          style="border:1px solid rgba(0,0,0,.12); background: linear-gradient(135deg, #0b1633, #0f2a66);
                 color: rgba(255,255,255,.96); border-radius:999px; padding:10px 14px; font-weight:850; cursor:pointer;">
          Skriv omdöme →
        </button>

        <button id="pr-pending-clear" type="button"
          style="border:1px solid rgba(0,0,0,.12); background:#fff; border-radius:999px; padding:10px 14px; font-weight:800; cursor:pointer;">
          Rensa affärsdata
        </button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const hide = () => {
      try { overlay.remove(); } catch {}
    };

    card.querySelector("#pr-pending-close")?.addEventListener("click", hide);

    card.querySelector("#pr-pending-clear")?.addEventListener("click", () => {
      clearAllPendingEverywhere();
      try {
        // ta bort även pr om vi rensar
        const url = new URL(window.location.href);
        url.searchParams.delete("source");
        url.searchParams.delete("pageUrl");
        url.searchParams.delete("proofRef");
        url.searchParams.delete("pr");
        window.history.replaceState({}, "", url.toString());
      } catch {}
      hide();
    });

    card.querySelector("#pr-pending-go")?.addEventListener("click", () => {
      hide();

      // Viktigt: ratingForm.js bygger locked-card. Vi scroller bara dit.
      const target =
        document.getElementById("locked-rating-card") ||
        document.getElementById("verified-deals-card") ||
        document.getElementById("rate-context-card") ||
        document.getElementById("rating-form") ||
        document.getElementById("rating-card") ||
        document.querySelector("form");

      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } catch {}
}

function shouldRunGuardsNow() {
  try {
    // Kör alltid på rate.html
    if (isRatePage()) return true;

    // Kör om det finns query som tyder på pending
    const qs = new URLSearchParams(window.location.search || "");
    if (qs.get("source") || qs.get("pageUrl") || qs.get("proofRef") || qs.get("pr")) return true;

    // Kör om det redan finns legacy pending (så vi kan rensa vid user switch)
    if (readLegacyPending()) return true;

    // Kör om sessionStorage har något pending
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("peerRatePendingDeal:")) return true;
    }
  } catch {}
  return false;
}

export function initRatingContextGuards() {
  try {
    // SUPERviktigt: kör inte alls om vi inte behöver (för att inte riskera krascha andra sidor)
    if (!shouldRunGuardsNow()) return;

    let last = (localStorage.getItem(LAST_USER_KEY) || "").trim().toLowerCase();
    let current = getUserKey();
    localStorage.setItem(LAST_USER_KEY, current);

    // Om vi just bytt användare: rensa ALL pending direkt
    if (last && last !== current) {
      clearAllPendingEverywhere();
    }

    // Läs deal från query och spara per user (OBS: pr hanteras av ratingForm, men vi kan ändå spara basic)
    const dealFromQuery = readDealFromQuery();
    if (dealFromQuery) {
      writePendingDealFor(current, dealFromQuery);
      // ta bort source/pageUrl/proofRef så den inte återkommer
      removeQueryParams();
    }

    // Om pending ligger kvar under "anon" men vi nu är inloggade: flytta
    if (current !== "anon") {
      const anon = readPendingDealFor("anon");
      const mine = readPendingDealFor(current);
      if (anon && !mine) writePendingDealFor(current, anon);
      clearPendingDealFor("anon");
    }

    // Visa overlay på rate.html om pending finns (per user eller legacy)
    if (isRatePage()) {
      const pending = readPendingDealFor(current) || readLegacyPending();
      if (pending) setTimeout(() => createOverlayIfNeeded(pending), 120);
    }

    // Poll user switch (logout/login utan reload)
    setInterval(() => {
      try {
        const now = getUserKey();
        const prev = (localStorage.getItem(LAST_USER_KEY) || "").trim().toLowerCase();
        if (prev && now !== prev) {
          clearAllPendingEverywhere();
          localStorage.setItem(LAST_USER_KEY, now);
        }
      } catch {}
    }, 500);
  } catch (e) {
    // Absolut aldrig krascha hela sajten
    console.warn("[PeerRate] ratingContext guards failed (ignored):", e);
  }
}