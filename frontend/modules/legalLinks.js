// frontend/modules/legalLinks.js
import { getCurrentLanguage } from "/modules/landing/language.js";

const LEGAL_LINK_LABELS = {
  sv: {
    terms: "Allmänna villkor",
  },
  en: {
    terms: "Terms",
  },
};

function getLabels() {
  const lang = getCurrentLanguage();
  return LEGAL_LINK_LABELS[lang] || LEGAL_LINK_LABELS.en;
}

export function applyLegalLinksLanguage(root = document) {
  const labels = getLabels();

  const termsLink =
    (root && typeof root.getElementById === "function" && root.getElementById("footerTermsLink")) ||
    document.getElementById("footerTermsLink");

  if (termsLink) {
    termsLink.textContent = labels.terms;
  }
}

let bound = false;

export function initLegalLinksLanguage() {
  if (!bound) {
    bound = true;
    window.addEventListener("peerrate:language-changed", () => {
      applyLegalLinksLanguage(document);
    });
  }

  applyLegalLinksLanguage(document);
}