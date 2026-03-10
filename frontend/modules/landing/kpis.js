// frontend/modules/landing/kpis.js

const KPI_ENDPOINT = "/api/stats/kpis";

function getLocale() {
  const lang = (document.documentElement.getAttribute("lang") || "sv").toLowerCase();
  return lang.startsWith("en") ? "en-US" : "sv-SE";
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(getLocale()).format(n);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value;
}

async function fetchKpis() {
  const response = await fetch(KPI_ENDPOINT, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`KPI request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!data || data.ok !== true || !data.kpis) {
    throw new Error("Invalid KPI response payload");
  }

  return data.kpis;
}

export function initKpis() {
  const kUsers = document.getElementById("kUsers");
  const kTx = document.getElementById("kTx");
  const kRatings = document.getElementById("kRatings");

  if (!kUsers && !kTx && !kRatings) {
    return;
  }

  setText(kUsers, "—");
  setText(kTx, "—");
  setText(kRatings, "—");

  fetchKpis()
    .then((kpis) => {
      setText(kUsers, formatNumber(kpis.registeredUsers));
      setText(kTx, formatNumber(kpis.verifiedTransactions));
      setText(kRatings, formatNumber(kpis.ratings));
    })
    .catch((err) => {
      console.warn("[landing:kpis] Could not load live KPIs:", err);
      setText(kUsers, "—");
      setText(kTx, "—");
      setText(kRatings, "—");
    });
}