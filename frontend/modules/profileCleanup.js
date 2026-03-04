// frontend/modules/profileCleanup.js
// Tar bort legacy Tradera-text om den ändå renderas av gammal kod.

const LEGACY_TEXT = "Ingen Tradera-koppling hittades för ditt konto ännu.";

function cleanup() {
  // 1) ta bort element med legacy-text
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];

  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n?.nodeValue?.trim() === LEGACY_TEXT) hits.push(n);
  }

  for (const textNode of hits) {
    const el = textNode.parentElement;
    const container = el?.closest("section, .card, div") || el;
    container?.remove();
  }

  // 2) om tradera-card ändå finns via injection
  const traderaCard = document.getElementById("tradera-card");
  if (traderaCard) traderaCard.remove();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cleanup);
} else {
  cleanup();
}