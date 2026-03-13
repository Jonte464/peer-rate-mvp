// extension/shared/payload.js
(function () {
  function encodePayload(payload) {
    const json = JSON.stringify(payload || {});
    return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
  }

  function buildRateUrl(payload) {
    return `https://peerrate.ai/rate.html#pr=${encodePayload(payload)}`;
  }

  window.PeerRateShared = window.PeerRateShared || {};
  window.PeerRateShared.payload = {
    encodePayload,
    buildRateUrl
  };
})();