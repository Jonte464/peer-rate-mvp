// frontend/modules/ratingContext.js
// 1) Rensar “rating context” när användaren byter konto
// 2) Lagrar pending deal per användare
// 3) Visar en “gate/overlay” på rate.html om pending deal finns

import auth from "./auth.js";

const LAST_USER_KEY = "peerRateLastUserKey";

// Legacy keys som kan ligga kvar från äldre kod/extension
const LEGACY_CONTEXT_KEYS = [
  "peerRateRatingContext",
  "peerRateRateContext",
  "peerRatePrefill",
  "ratingContext",
  "rateContext",
  "peerRateDraftRating",
  "peerRatePendingRating",
];

function getUserKey() {
  const u = auth.getUser?.() || null;
  const email = (u?.email || u?.customer?.email || "").trim().toLowerCase();
  // Om ingen email finns (ej inloggad): använd "anon"
  return email || "anon";
}

function perUserKey(base) {
  return `${base}:${getUserKey()}`;
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function clearLegacyContext() {
  // Rensa legacy storage keys (både localStorage och sessionStorage)
  for (const k of LEGACY_CONTEXT_KEYS) {
    try { localStorage.removeItem(k); } catch {}
    try { sessionStorage.removeItem(k); } catch {}
  }

  // Rensa även per-user pending i sessionStorage (för säkerhets skull)
  try {
    const prefix = "peerRatePendingDeal:";
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {}
}

function maybeClearOnUserSwitch() {
  const now = getUserKey();
  const prev = (localStorage.getItem(LAST_USER_KEY) || "").trim().toLowerCase();

  if (prev && prev !== now) {
    // ✅ användaren bytte konto => rensa gamla pending/prefill
    clearLegacyContext();
  }

  localStorage.setItem(LAST_USER_KEY, now);
}

function readPendingDeal() {
  // 1) Per-user pending deal (sessionStorage)
  const v = sessionStorage.getItem(perUserKey("peerRatePendingDeal"));
  const obj = safeJsonParse(v);
  if (obj && typeof obj === "object") return obj;

  // 2) Legacy (om något gammalt ligger kvar)
  const legacy =
    safeJsonParse(sessionStorage.getItem("peerRatePendingDeal")) ||
    safeJsonParse(localStorage.getItem("peerRatePendingDeal")) ||
    safeJsonParse(localStorage.getItem("peerRateRatingContext"));

  if (legacy && typeof legacy === "object") return legacy;

  return null;
}

function writePendingDeal(deal) {
  sessionStorage.setItem(perUserKey("peerRatePendingDeal"), JSON.stringify(deal || {}));
}

function clearPendingDeal() {
  sessionStorage.removeItem(perUserKey("peerRatePendingDeal"));
}

function readDealFromQuery() {
  const params = new URLSearchParams(window.location.search || "");
  const source = (params.get("source") || "").trim();
  const pageUrl = (params.get("pageUrl") || "").trim();
  const proofRef = (params.get("proofRef") || "").trim();

  if (!source && !pageUrl && !proofRef) return null;

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
  };
}

function createOverlayIfNeeded(deal) {
  if (!deal) return;

  // Om overlay redan finns -> gör inget
  if (document.getElementById("pr-pending-overlay")) return;

  // Lägg en blockerande overlay
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
        För att gå vidare behöver du välja ett omdöme och skicka in det.
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

  const closeBtn = card.querySelector("#pr-pending-close");
  const goBtn = card.querySelector("#pr-pending-go");
  const clearBtn = card.querySelector("#pr-pending-clear");

  const hide = () => overlay.remove();

  closeBtn?.addEventListener("click", hide);

  clearBtn?.addEventListener("click", () => {
    clearPendingDeal();
    hide();
    // även rensa query params utan reload (så den inte kommer tillbaka)
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("source");
      url.searchParams.delete("pageUrl");
      url.searchParams.delete("proofRef");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  });

  goBtn?.addEventListener("click", () => {
    hide();
    // Scrolla till rating-form om den finns
    const form =
      document.getElementById("rating-form") ||
      document.getElementById("rating-card") ||
      document.querySelector("form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// små helpers för att undvika att vi råkar injicera konstiga tecken i HTML
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeAttr(s) {
  return String(s || "").replaceAll('"', "%22");
}

/**
 * Körs från main.js
 */
export function initRatingContextGuards() {
  maybeClearOnUserSwitch();

  // Spara deal från query (extension skickar ofta source + pageUrl)
  const dealFromQuery = readDealFromQuery();
  if (dealFromQuery) {
    writePendingDeal(dealFromQuery);
  }

  // Visa overlay endast på rate-sidan
  const path = (window.location.pathname || "").toLowerCase();
  const isRate =
    path.endsWith("/rate.html") ||
    path.includes("/rate") ||
    !!document.getElementById("rating-card") ||
    !!document.getElementById("rating-form");

  if (!isRate) return;

  const pending = readPendingDeal();
  if (pending) {
    // Vänta lite så att sidan hinner rita UI först
    setTimeout(() => createOverlayIfNeeded(pending), 120);
  }
}