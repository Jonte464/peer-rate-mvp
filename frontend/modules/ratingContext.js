// frontend/modules/ratingContext.js
// Säker pending-hantering som inte kan krascha hela sajten.
// - Pending sparas per user i sessionStorage
// - Pending speglas även till localStorage (peerrate_pending_rating_v2) för ratingForm.js
// - Pending flyttas från anon -> inloggad användare istället för att rensas bort
// - Pending rensas bara vid verkligt användarbyte mellan två olika riktiga användare
// - Overlay visas bara på rate.html

import auth from "./auth.js";
import { t } from "./landing/language.js";

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
  "peerrate_pending_rating_v2",
];

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

function getBestEmailGuess() {
  try {
    const u = auth.getUser?.() || null;
    const emailFromAuth = (u?.email || u?.customer?.email || "").trim().toLowerCase();
    if (emailFromAuth) return emailFromAuth;

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

function writeLegacyPending(deal) {
  try {
    if (!deal || typeof deal !== "object") return;
    localStorage.setItem(
      LEGACY_PENDING_KEY,
      JSON.stringify({ ...(deal || {}), _ts: nowMs() })
    );
  } catch {}
}

function clearLegacyPending() {
  try {
    localStorage.removeItem(LEGACY_PENDING_KEY);
  } catch {}
}

export function clearAllPendingEverywhere() {
  try {
    for (const k of LEGACY_CONTEXT_KEYS) {
      try { localStorage.removeItem(k); } catch {}
      try { sessionStorage.removeItem(k); } catch {}
    }

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

  const current = getUserKey();
  if (userKey === current || userKey === "anon") {
    clearLegacyPending();
  }

  try {
    window.dispatchEvent(new CustomEvent("pr:pending-cleared"));
  } catch {}
}

function movePendingDeal(fromUserKey, toUserKey) {
  try {
    if (!fromUserKey || !toUserKey || fromUserKey === toUserKey) return false;

    const existingTarget = readPendingDealFor(toUserKey);
    if (existingTarget) return true;

    const fromPending = readPendingDealFor(fromUserKey);
    if (!fromPending) return false;

    writePendingDealFor(toUserKey, fromPending);
    try {
      sessionStorage.removeItem(perUserKey("peerRatePendingDeal", fromUserKey));
    } catch {}

    return true;
  } catch {
    return false;
  }
}

function readDealFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const source = (params.get("source") || "").trim();
    const pageUrl = (params.get("pageUrl") || "").trim();
    const proofRef = (params.get("proofRef") || "").trim();
    const pr = (params.get("pr") || "").trim();

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

    const prettySource = deal.source ? deal.source : t("rate_overlay_unknown_platform", "Okänd plattform");

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="font-weight:850; letter-spacing:-.01em; font-size:16px;">
          ${escapeHtml(t("rate_overlay_title", "Du har en affär att betygsätta"))}
        </div>
        <button id="pr-pending-close" type="button"
          style="border:1px solid rgba(0,0,0,.12); background:#fff; border-radius:999px; padding:8px 12px; font-weight:750; cursor:pointer;">
          ${escapeHtml(t("rate_overlay_close", "Inte nu"))}
        </button>
      </div>

      <div style="margin-top:10px; font-size:13px; opacity:.75; line-height:1.5;">
        <div><b>${escapeHtml(t("rate_overlay_platform_label", "Plattform:"))}</b> ${escapeHtml(prettySource)}</div>
        ${deal.proofRef ? `<div><b>${escapeHtml(t("rate_overlay_reference_label", "Referens:"))}</b> ${escapeHtml(deal.proofRef)}</div>` : ""}
        ${deal.pageUrl ? `<div style="margin-top:6px;"><a href="${escapeAttr(deal.pageUrl)}" target="_blank" rel="noreferrer"
           style="color:inherit; text-decoration:underline;">${escapeHtml(t("rate_overlay_open_deal", "Öppna affären"))}</a></div>` : ""}
        <div style="margin-top:8px;">
          ${escapeHtml(t("rate_overlay_body", "För att fortsätta behöver du antingen skriva omdöme eller rensa affärsdata."))}
        </div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
        <button id="pr-pending-go" type="button"
          style="border:1px solid rgba(0,0,0,.12); background: linear-gradient(135deg, #0b1633, #0f2a66);
                 color: rgba(255,255,255,.96); border-radius:999px; padding:10px 14px; font-weight:850; cursor:pointer;">
          ${escapeHtml(t("rate_overlay_go", "Skriv omdöme →"))}
        </button>

        <button id="pr-pending-clear" type="button"
          style="border:1px solid rgba(0,0,0,.12); background:#fff; border-radius:999px; padding:10px 14px; font-weight:800; cursor:pointer;">
          ${escapeHtml(t("rate_overlay_clear", "Rensa affärsdata"))}
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

      const loginTarget =
        document.getElementById("login-card") ||
        document.getElementById("rating-login-card") ||
        document.getElementById("rating-login-form");

      const formTarget =
        document.getElementById("locked-rating-card") ||
        document.getElementById("verified-deals-card") ||
        document.getElementById("rate-context-card") ||
        document.getElementById("rating-form") ||
        document.getElementById("rating-card") ||
        document.querySelector("form");

      const currentUser = getUserKey();

      if (!currentUser || currentUser === "anon") {
        if (loginTarget) {
          loginTarget.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }

      if (formTarget) {
        formTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  } catch {}
}

function shouldRunGuardsNow() {
  try {
    if (isRatePage()) return true;

    const qs = new URLSearchParams(window.location.search || "");
    if (qs.get("source") || qs.get("pageUrl") || qs.get("proofRef") || qs.get("pr")) return true;

    if (readLegacyPending()) return true;

    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("peerRatePendingDeal:")) return true;
    }
  } catch {}
  return false;
}

function handleUserTransition(prev, next) {
  try {
    if (!prev) {
      localStorage.setItem(LAST_USER_KEY, next);
      return;
    }

    if (prev === next) {
      localStorage.setItem(LAST_USER_KEY, next);
      return;
    }

    // Viktigaste fixen:
    // Om vi går från anon -> riktig användare, flytta pending i stället för att rensa.
    if (prev === "anon" && next !== "anon") {
      movePendingDeal("anon", next);
      localStorage.setItem(LAST_USER_KEY, next);
      return;
    }

    // Om vi går från riktig användare -> anon, rensa inte direkt.
    // Då kan sidan vara mitt i auth-hydrering eller refresh.
    if (prev !== "anon" && next === "anon") {
      localStorage.setItem(LAST_USER_KEY, next);
      return;
    }

    // Bara om två olika riktiga användare byts ska pending rensas helt.
    if (prev !== "anon" && next !== "anon" && prev !== next) {
      clearAllPendingEverywhere();
      localStorage.setItem(LAST_USER_KEY, next);
      return;
    }

    localStorage.setItem(LAST_USER_KEY, next);
  } catch {}
}

export function initRatingContextGuards() {
  try {
    if (!shouldRunGuardsNow()) return;

    const last = (localStorage.getItem(LAST_USER_KEY) || "").trim().toLowerCase();
    const current = getUserKey();

    handleUserTransition(last, current);

    const effectiveUser = getUserKey();

    const dealFromQuery = readDealFromQuery();
    if (dealFromQuery) {
      writePendingDealFor(effectiveUser, dealFromQuery);
      removeQueryParams();
    }

    if (effectiveUser !== "anon") {
      const anon = readPendingDealFor("anon");
      const mine = readPendingDealFor(effectiveUser);
      if (anon && !mine) writePendingDealFor(effectiveUser, anon);
      try {
        sessionStorage.removeItem(perUserKey("peerRatePendingDeal", "anon"));
      } catch {}
    }

    if (isRatePage()) {
      const pending = readPendingDealFor(effectiveUser) || readLegacyPending();
      if (pending) setTimeout(() => createOverlayIfNeeded(pending), 120);
    }

    setInterval(() => {
      try {
        const now = getUserKey();
        const prev = (localStorage.getItem(LAST_USER_KEY) || "").trim().toLowerCase();
        if (now !== prev) {
          handleUserTransition(prev, now);
        }
      } catch {}
    }, 1000);
  } catch (e) {
    console.warn("[PeerRate] ratingContext guards failed (ignored):", e);
  }
}