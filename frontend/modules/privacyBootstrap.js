// frontend/modules/privacyBootstrap.js
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

(async function bootPrivacy() {
  try {
    await injectPartial("slot-top-row", "/partials/index/top-row.html");
  } catch (e) {
    console.warn("Top row inject failed:", e);
  }

  try {
    initLandingLanguage();
  } catch (e) {
    console.warn("initLandingLanguage failed:", e);
  }

  try {
    initTopRow();
  } catch (e) {
    console.warn("initTopRow failed:", e);
  }

  try {
    await injectPartial("slot-footer", "/partials/index/footer.html");
  } catch (e) {
    console.warn("footer inject failed:", e);
  }

  try {
    applyLang(document);
  } catch (e) {
    console.warn("applyLang failed:", e);
  }

  try {
    await import("/modules/main.js");
  } catch (e) {
    console.warn("Could not load main.js (non-fatal):", e);
  }

  try {
    initTopRow();
  } catch (_) {}

  try {
    applyLang(document);
  } catch (_) {}
})();