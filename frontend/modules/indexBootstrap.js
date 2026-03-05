// frontend/modules/indexBootstrap.js
import { initLandingLanguage } from "/modules/landing/language.js";
import { initTopRow } from "/modules/topRow.js";

async function injectPartial(slotId, url) {
  const slot = document.getElementById(slotId);
  if (!slot) return false;

  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load partial ${url} (${res.status})`);

  slot.innerHTML = await res.text();
  return true;
}

(async function bootIndex() {
  // 1) Inject TOP ROW FIRST (så gubbe/hamburgare/language kan bindas säkert)
  try {
    await injectPartial("slot-top-row", "/partials/index/top-row.html");
  } catch (e) {
    console.warn("Top row inject failed:", e);
  }

  // 2) Init language (needs langBtn/langMenu)
  try {
    initLandingLanguage();
  } catch (e) {
    console.warn("initLandingLanguage failed:", e);
  }

  // 3) Init top row interactions AFTER injection
  try {
    initTopRow();
  } catch (e) {
    console.warn("initTopRow failed:", e);
  }

  // 4) Inject remaining landing partials
  try { await injectPartial("slot-hero", "/partials/index/hero.html"); } catch (e) { console.warn("hero inject failed:", e); }
  try { await injectPartial("slot-how", "/partials/index/how.html"); } catch (e) { console.warn("how inject failed:", e); }
  try { await injectPartial("slot-sim", "/partials/index/sim.html"); } catch (e) { console.warn("sim inject failed:", e); }
  try { await injectPartial("slot-globe", "/partials/index/globe.html"); } catch (e) { console.warn("globe inject failed:", e); }
  try { await injectPartial("slot-footer", "/partials/index/footer.html"); } catch (e) { console.warn("footer inject failed:", e); }

  // 5) Load site logic
  try {
    await import("/modules/main.js");
  } catch (e) {
    console.warn("Could not load main.js (non-fatal):", e);
  }

  // 6) Load landing logic (if used)
  try {
    await import("/modules/landing/init.js");
  } catch (e) {
    // non-fatal
  }

  // 7) Safety: if något på index fortfarande init:ar för tidigt, re-run topRow (idempotent)
  try {
    initTopRow();
  } catch (_) {}
})();