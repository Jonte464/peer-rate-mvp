// extension/service-worker.js
// Tar emot "openRating" från content-script och öppnar PeerRate-sidan i ny flik.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "openRating") return;

  const url = msg.url;
  if (!url) return;

  chrome.tabs.create({ url });
  sendResponse({ ok: true });
});
