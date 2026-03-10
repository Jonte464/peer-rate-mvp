// frontend/modules/termsBootstrap.js
import { initLandingLanguage, applyLang, getCurrentLanguage } from "/modules/landing/language.js";
import { initTopRow } from "/modules/topRow.js";
import { initLegalLinksLanguage, applyLegalLinksLanguage } from "/modules/legalLinks.js";

const termsDict = {
  sv: {
    metaTitle: "PeerRate – Allmänna villkor",
    kicker: "Legal & trust",
    title: "Allmänna villkor för PeerRate",
    lead:
      "Dessa villkor beskriver hur PeerRate får användas, vilka regler som gäller för konton, omdömen, browser extension-flödet och vilken ansvarsfördelning som gäller mellan dig och PeerRate.",
    version: "Version 1.1 – Gäller från och med 2025-01-01",

    s1_title: "1. Introduktion",
    s1_p1:
      "Dessa användarvillkor (“Villkoren”) reglerar relationen mellan dig som användare (“Användaren”) och JRAS Intressenter AB / PeerRate (“PeerRate”, “vi”, “oss”, “vår”) vid användning av PeerRates webbplats, användarkonton, omdömessystem och browser extension.",
    s1_p2:
      "Genom att registrera ett konto, använda tjänsten, installera browser extensionen eller på annat sätt interagera med PeerRate bekräftar du att du har tagit del av och accepterar dessa Villkor.",

    s2_title: "2. Tjänstens omfattning",
    s2_p1:
      "PeerRate är en tjänst för verifierbara omdömen, identitetskoppling och trust-signaler mellan användare, särskilt i peer-to-peer-sammanhang som köp, försäljning, uppdrag, uthyrning eller andra överenskommelser.",
    s2_p2:
      "Tjänsten kan omfatta funktioner för användarprofiler, omdömen, verifierade affärer, browser extensioner, externa datakopplingar och andra relaterade funktioner. PeerRate kan när som helst utveckla, ändra, pausa eller ta bort delar av tjänsten.",

    s3_title: "3. Konto och användaransvar",
    s3_p1:
      "För att använda vissa delar av tjänsten måste du registrera ett konto och lämna korrekta, fullständiga och aktuella uppgifter.",
    s3_li1: "du ansvarar för att uppgifterna du lämnar är riktiga",
    s3_li2: "du ansvarar för att skydda dina inloggningsuppgifter",
    s3_li3: "du får inte låta någon annan använda ditt konto på ett otillåtet sätt",
    s3_li4: "du ansvarar för aktivitet som sker via ditt konto, såvida du inte utan dröjsmål rapporterat obehörig användning",

    s4_title: "4. Omdömen och användargenererat innehåll",
    s4_p1:
      "Du ansvarar för allt innehåll du publicerar genom PeerRate, inklusive omdömen, kommentarer, rapporter och annan information.",
    s4_p2:
      "Innehåll måste vara relevant för den faktiska interaktionen, sakligt utformat och får inte vara falskt, vilseledande, hotfullt, trakasserande, diskriminerande, ärekränkande eller annars otillbörligt.",
    s4_p3:
      "PeerRate har rätt att granska, begränsa, dölja eller ta bort innehåll som enligt vår bedömning bryter mot lag, dessa Villkor eller syftet med tjänsten.",

    s5_title: "5. Verifierade affärer och browser extension",
    s5_p1:
      "PeerRate kan använda ett browser extension-flöde eller annan teknisk verifiering för att koppla omdömen till verkliga affärer eller offentligt synlig transaktionsinformation.",
    s5_p2:
      "När du använder extensionen godkänner du att PeerRate får läsa sådan offentligt synlig information som är nödvändig för att identifiera en affär, skapa verifieringsunderlag och möjliggöra ett omdöme kopplat till affären.",
    s5_p3:
      "Extensionen är inte avsedd att samla in lösenord, privata meddelanden, betalningsuppgifter eller andra känsliga personuppgifter, och får inte användas för att kringgå säkerhetsmekanismer eller på annat sätt missbruka tredjepartsplattformar.",
    s5_p4:
      "PeerRate är inte anslutet till, sponsrat av eller officiellt godkänt av Tradera, Blocket, eBay, Google eller andra plattformar, om detta inte uttryckligen anges.",

    s6_title: "6. Tredjepartsdata och externa källor",
    s6_p1:
      "PeerRate kan inhämta, bearbeta och sammanställa information från öppna, lagliga eller licensierade datakällor i syfte att förbättra verifiering, tillförlitlighet och säkerhet i tjänsten.",
    s6_p2:
      "Sådan behandling ska ske i enlighet med tillämplig lag, inklusive GDPR, avtalsvillkor från relevanta dataleverantörer och interna säkerhetskrav.",

    s7_title: "7. Tillåten och förbjuden användning",
    s7_p1: "Du får inte använda PeerRate för att:",
    s7_li1: "publicera falska eller manipulerade omdömen",
    s7_li2: "utge dig för att vara någon annan",
    s7_li3: "försöka kringgå tekniska begränsningar, säkerhetsfunktioner eller verifieringsregler",
    s7_li4: "samla in, kopiera eller återanvända data från tjänsten i strid med lag eller Villkoren",
    s7_li5: "störa, överbelasta eller skada tjänsten eller dess användare",
    s7_li6: "använda tjänsten på ett sätt som bryter mot lag, tredjepartsrättigheter eller tillämpliga plattformsregler",

    s8_title: "8. Avstängning och uppsägning",
    s8_p1:
      "PeerRate har rätt att med omedelbar verkan begränsa, stänga av eller avsluta ett konto eller blockera åtkomst till tjänsten om vi misstänker att:",
    s8_li1: "oriktiga uppgifter har lämnats",
    s8_li2: "tjänsten missbrukas eller manipuleras",
    s8_li3: "lag eller Villkoren har överträtts",
    s8_li4: "PeerRate, andra användare eller samarbetspartners riskerar att skadas",

    s9_title: "9. Immateriella rättigheter",
    s9_p1:
      "PeerRate och dess innehåll, design, logotyper, struktur, texter, kod, sammanställningar och funktionalitet tillhör PeerRate eller dess licensgivare.",
    s9_p2:
      "Du får inte kopiera, distribuera, sälja, dekompilera eller skapa bearbetningar av tjänsten eller dess innehåll utöver vad som uttryckligen följer av tvingande lag eller skriftligt tillstånd från PeerRate.",

    s10_title: "10. Ansvarsbegränsning",
    s10_p1:
      "PeerRate tillhandahålls i befintligt skick och i den omfattning som är tillåten enligt lag utan garantier om oavbruten tillgänglighet, fullständig riktighet, viss funktionalitet eller lämplighet för ett visst syfte.",
    s10_p2:
      "PeerRate ansvarar inte för indirekta skador, utebliven vinst, förlorade affärer, beslut fattade av användare eller tvister mellan användare som grundas på information eller omdömen i tjänsten.",
    s10_p3:
      "PeerRates ansvar är under alla omständigheter begränsat till vad som följer av tvingande lag.",

    s11_title: "11. Ändringar av tjänsten och villkoren",
    s11_p1:
      "PeerRate får när som helst uppdatera tjänsten och dessa Villkor. Vid väsentliga ändringar kan information lämnas via e-post, på webbplatsen eller i tjänsten.",
    s11_p2:
      "Fortsatt användning efter att uppdaterade Villkor trätt i kraft innebär att du accepterar den uppdaterade versionen.",

    s12_title: "12. Tillämplig lag och tvist",
    s12_p1:
      "Dessa Villkor ska tolkas och tillämpas enligt svensk lag. Tvister som inte kan lösas i samförstånd ska avgöras av svensk allmän domstol, med Stockholm tingsrätt som första instans, om inte annat följer av tvingande lag.",

    s13_title: "13. Kontakt",
    s13_p1: "För frågor om tjänsten eller dessa Villkor, kontakta:",
    s13_p2:
      "Dessa Villkor gäller även för PeerRates browser extension som distribueras via Chrome Web Store eller annan officiell distributionskanal.",
  },

  en: {
    metaTitle: "PeerRate – Terms",
    kicker: "Legal & trust",
    title: "Terms for PeerRate",
    lead:
      "These terms describe how PeerRate may be used, which rules apply to accounts, ratings, the browser extension flow, and how responsibility is allocated between you and PeerRate.",
    version: "Version 1.1 – Effective from 2025-01-01",

    s1_title: "1. Introduction",
    s1_p1:
      "These Terms of Use (“Terms”) govern the relationship between you as a user (“User”) and JRAS Intressenter AB / PeerRate (“PeerRate”, “we”, “us”, “our”) when using PeerRate’s website, user accounts, reputation system, and browser extension.",
    s1_p2:
      "By registering an account, using the service, installing the browser extension, or otherwise interacting with PeerRate, you confirm that you have read and accepted these Terms.",

    s2_title: "2. Scope of the service",
    s2_p1:
      "PeerRate is a service for verifiable ratings, identity-linked trust signals, and reputation-related functionality between users, especially in peer-to-peer contexts such as purchases, sales, assignments, rentals, or other agreements.",
    s2_p2:
      "The service may include user profiles, ratings, verified deals, browser extensions, external data connections, and other related features. PeerRate may at any time develop, modify, pause, or remove parts of the service.",

    s3_title: "3. Account and user responsibility",
    s3_p1:
      "To use certain parts of the service, you must register an account and provide accurate, complete, and current information.",
    s3_li1: "you are responsible for ensuring that the information you provide is correct",
    s3_li2: "you are responsible for safeguarding your login credentials",
    s3_li3: "you may not allow another person to use your account in an unauthorized way",
    s3_li4:
      "you are responsible for activity carried out through your account unless you promptly report unauthorized use",

    s4_title: "4. Ratings and user-generated content",
    s4_p1:
      "You are responsible for all content you publish through PeerRate, including ratings, comments, reports, and other information.",
    s4_p2:
      "Content must be relevant to the actual interaction, fact-based in nature, and must not be false, misleading, threatening, harassing, discriminatory, defamatory, or otherwise improper.",
    s4_p3:
      "PeerRate may review, restrict, hide, or remove content that in our judgment violates law, these Terms, or the purpose of the service.",

    s5_title: "5. Verified deals and browser extension",
    s5_p1:
      "PeerRate may use a browser extension flow or other technical verification methods to connect ratings to real transactions or publicly visible transaction information.",
    s5_p2:
      "When using the extension, you agree that PeerRate may read publicly visible information necessary to identify a deal, create verification records, and enable a rating connected to that deal.",
    s5_p3:
      "The extension is not intended to collect passwords, private messages, payment details, or other sensitive personal data, and may not be used to bypass security mechanisms or otherwise misuse third-party platforms.",
    s5_p4:
      "PeerRate is not affiliated with, sponsored by, or officially endorsed by Tradera, Blocket, eBay, Google, or any other platform unless expressly stated.",

    s6_title: "6. Third-party data and external sources",
    s6_p1:
      "PeerRate may collect, process, and compile information from public, lawful, or licensed data sources in order to improve verification, reliability, and safety in the service.",
    s6_p2:
      "Such processing must take place in accordance with applicable law, including GDPR, relevant data-provider terms, and internal security requirements.",

    s7_title: "7. Permitted and prohibited use",
    s7_p1: "You may not use PeerRate to:",
    s7_li1: "publish false or manipulated ratings",
    s7_li2: "impersonate another person",
    s7_li3: "attempt to bypass technical restrictions, security features, or verification rules",
    s7_li4: "collect, copy, or reuse data from the service in violation of law or these Terms",
    s7_li5: "interfere with, overload, or damage the service or its users",
    s7_li6:
      "use the service in a way that violates law, third-party rights, or applicable platform rules",

    s8_title: "8. Suspension and termination",
    s8_p1:
      "PeerRate may immediately restrict, suspend, terminate an account, or block access to the service if we suspect that:",
    s8_li1: "false information has been provided",
    s8_li2: "the service is being abused or manipulated",
    s8_li3: "law or these Terms have been violated",
    s8_li4: "PeerRate, other users, or partners risk being harmed",

    s9_title: "9. Intellectual property rights",
    s9_p1:
      "PeerRate and its content, design, logos, structure, texts, code, compilations, and functionality belong to PeerRate or its licensors.",
    s9_p2:
      "You may not copy, distribute, sell, decompile, or create derivative works from the service or its content except where expressly permitted by mandatory law or written consent from PeerRate.",

    s10_title: "10. Limitation of liability",
    s10_p1:
      "PeerRate is provided on an “as is” basis and, to the extent permitted by law, without warranties regarding uninterrupted availability, complete accuracy, specific functionality, or fitness for a particular purpose.",
    s10_p2:
      "PeerRate is not liable for indirect damages, lost profits, lost business, decisions made by users, or disputes between users based on information or ratings in the service.",
    s10_p3:
      "PeerRate’s liability is in all circumstances limited to what follows from mandatory law.",

    s11_title: "11. Changes to the service and the terms",
    s11_p1:
      "PeerRate may update the service and these Terms at any time. In the event of material changes, notice may be provided by email, on the website, or in the service.",
    s11_p2:
      "Continued use after updated Terms take effect means that you accept the updated version.",

    s12_title: "12. Governing law and disputes",
    s12_p1:
      "These Terms shall be governed by and interpreted in accordance with Swedish law. Disputes that cannot be resolved amicably shall be settled by Swedish general courts, with Stockholm District Court as the court of first instance, unless mandatory law provides otherwise.",

    s13_title: "13. Contact",
    s13_p1: "For questions about the service or these Terms, contact:",
    s13_p2:
      "These Terms also apply to the PeerRate browser extension distributed via the Chrome Web Store or any other official distribution channel.",
  },
};

function getTermsCopy() {
  const lang = getCurrentLanguage();
  return termsDict[lang] || termsDict.en;
}

function applyTermsTranslations(root = document) {
  const copy = getTermsCopy();

  if (copy.metaTitle) {
    document.title = copy.metaTitle;
  }

  root.querySelectorAll("[data-terms-key]").forEach((node) => {
    const key = node.getAttribute("data-terms-key");
    if (!key) return;

    const value = copy[key];
    if (value == null) return;

    node.textContent = value;
  });
}

async function injectPartial(slotId, url) {
  const slot = document.getElementById(slotId);
  if (!slot) return false;

  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load partial ${url} (${res.status})`);

  slot.innerHTML = await res.text();
  return true;
}

let termsLangBound = false;

function initTermsLanguageBinding() {
  if (termsLangBound) return;
  termsLangBound = true;

  window.addEventListener("peerrate:language-changed", () => {
    applyTermsTranslations(document);
    applyLegalLinksLanguage(document);
  });
}

(async function bootTerms() {
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
    initLegalLinksLanguage();
    applyLegalLinksLanguage(document);
  } catch (e) {
    console.warn("legal links language init failed:", e);
  }

  try {
    applyLang(document);
  } catch (e) {
    console.warn("applyLang failed:", e);
  }

  try {
    applyTermsTranslations(document);
    initTermsLanguageBinding();
  } catch (e) {
    console.warn("applyTermsTranslations failed:", e);
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
    applyLegalLinksLanguage(document);
  } catch (_) {}

  try {
    applyLang(document);
  } catch (_) {}

  try {
    applyTermsTranslations(document);
  } catch (_) {}
})();