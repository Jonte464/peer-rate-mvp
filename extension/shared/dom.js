// extension/shared/dom.js
(function () {
  const dom = {
    normalizeText(value) {
      return String(value || '').replace(/\u00A0/g, ' ').trim();
    },

    getBodyText() {
      return String(document.body?.innerText || '').replace(/\u00A0/g, ' ');
    },

    findFirstEmail(text) {
      const matches =
        String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      return matches.length ? dom.normalizeText(matches[0]).toLowerCase() : '';
    }
  };

  window.PeerRateShared = window.PeerRateShared || {};
  window.PeerRateShared.dom = dom;
})();