// frontend/modules/indexBootstrap.js
import { initLandingLanguage, applyLang } from "/modules/landing/language.js";
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

  // 5) Re-apply translations explicitly after all partials are injected
  try {
    applyLang(document);
  } catch (e) {
    console.warn("applyLang after partial injection failed:", e);
  }

  // 6) Load site logic
  try {
    await import("/modules/main.js");
  } catch (e) {
    console.warn("Could not load main.js (non-fatal):", e);
  }

  // 7) Load landing logic (if used)
  try {
    const landing = await import("/modules/landing/init.js");
    if (landing && typeof landing.initLanding === "function") {
      landing.initLanding();
    }
  } catch (e) {
    console.warn("landing init failed (non-fatal):", e);
  }

  // 8) Safety: re-run topRow + final translations
  try {
    initTopRow();
  } catch (_) {}

  try {
    applyLang(document);
  } catch (_) {}
})();