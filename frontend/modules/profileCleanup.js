// modules/profileCleanup.js
// Städar bort gamla Tradera-kopplingsrester som kan renderas av legacy-kod.

const LEGACY_TEXT = "Ingen Tradera-koppling hittades för ditt konto ännu.";

function removeLegacyTraderaMessage() {
  // 1) Ta bort element som exakt innehåller texten
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node || !node.nodeValue) continue;
    if (node.nodeValue.trim() === LEGACY_TEXT) {
      hits.push(node);
    }
  }

  for (const textNode of hits) {
    const el = textNode.parentElement;
    if (!el) continue;

    // Försök ta bort en rimlig container (section/card), annars parenten
    const container = el.closest("section, .card, div") || el;
    container.remove();
  }

  // 2) Extra: om det finns ett legacy "tradera-card" i DOM ändå (via injection), ta bort det.
  const traderaCard = document.getElementById("tradera-card");
  if (traderaCard) traderaCard.remove();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", removeLegacyTraderaMessage);
} else {
  removeLegacyTraderaMessage();
}