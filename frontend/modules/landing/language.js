// frontend/modules/landing/language.js
export function initLandingLanguage() {
  const langBtn = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');
  const langLabel = document.getElementById('langLabel');
  if (!langBtn || !langMenu || !langLabel) return;

  const dict = {
    sv: {
      top_sub: 'Förtroende du kan bevisa',

      // ✅ Top menu (universal)
      menu_home: 'Hem',
      menu_how: 'Hur det funkar',
      menu_sim: 'Se värdet direkt',
      menu_globe: 'Global trust',
      menu_rate: 'Lämna betyg',
      menu_signup: 'Registrera dig',
      menu_profile: 'Min profil',
      menu_extension: 'Installera extension',
      menu_workrefs: 'Arbetsreferenser',
      menu_ask: 'Se 5P-modellen',
      user_logout: 'Logga ut',

      profile_workrefs_title: 'Arbetsreferenser',
      profile_workrefs_lead: 'Samla och dela verifierbara referenser från uppdrag och arbetsgivare.',
      profile_workrefs_btn: 'Öppna arbetsreferenser',

      // ✅ Work references page (om du använder dessa nycklar)
      menu_refs: 'Arbetsreferenser',
      work_refs_title: 'Arbetsreferenser',
      work_refs_lead: 'Samla och visa verifierade arbetsreferenser från chefer, kollegor och uppdragsgivare.',
      work_refs_open: 'Öppna arbetsreferenser',
      work_refs_invite: 'Bjud in en referens',
      work_refs_status_title: 'Status',
      work_refs_status_body: '(Demo) Här kommer dina referenser att listas. Nästa steg är att koppla detta till LinkedIn-inloggning och ett enkelt “be om referens”-flöde.',

      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Förtroende du kan bevisa.',
      hero_p: 'PeerRate gör att du kan bära med dig verifierad trovärdighet mellan marknadsplatser. Inte känsla. Inte påståenden. Riktiga transaktioner — portabelt och svårt att fejka.',
      hero_cta_primary: 'Kom igång',
      hero_cta_secondary: 'Logga in',
      hero_card_title: 'Ett reputation card du kan dela',
      hero_card_p: 'Ett kompakt kvitto på hur du agerar i P2P — över plattformar.',
      hero_metric_score: 'Förtroende (1–5)',
      hero_metric_tx: 'Verifierade transaktioner',

      how_title: 'En snabbfil för människor online.',
      how_lead: 'PeerRate standardiserar betyg och kopplar dem till riktiga affärer — så att förtroende blir mätbart, portabelt och rättvist.',
      f1_title: 'Verifierat',
      f1_p: 'Koppla reputation till riktiga transaktioner. Mindre bedrägeri, färre missar.',
      f2_title: 'Portabelt',
      f2_p: 'Ta med din trust score mellan marknadsplatser istället för att börja från noll.',
      f3_title: 'Förklarbart',
      f3_p: 'Tydligt vad som påverkar din score — inte en svart låda.',

      sim_title: 'Se värdet direkt.',
      rep_trust: 'Förtroende (1–5)',
      rep_tx: 'Verifierade transaktioner',
      rep_plat: 'Plattformar kopplade',
      rep_tap: 'Tryck',
      rep_explain: 'Förklaring',
      rep_btn: 'Öppna min profil',
      rep_btn2: 'Förklara min trust',

      back_title: 'Varför denna nivå?',
      back_p: 'Förtroendet bygger på verifierade transaktioner, kvalitet i omdömen, aktualitet och risksignaler. Målet är att göra förtroende portabelt och svårt att fejka.',
      back_b1: 'Verifierad historik',
      back_t1: 'Fler verifierade affärer höjer säkerheten.',
      back_b2: 'Stabilitet',
      back_t2: 'Jämn positiv historik över tid belönas.',
      back_b3: 'Risksignaler',
      back_t3: 'Dispyter och mönster kan sänka nivån.',
      back_btn: 'Tillbaka',
      back_btn2: 'Fråga mer',

      sim_h3: 'Vad händer när fler lämnar omdömen – och de är bra?',
      sim_p: 'Två reglage styr den totala nivån. Få omdömen + lågt snitt ger låg nivå. Många omdömen + högt snitt ger 5P.',
      sim_count_label: 'Antal omdömen',
      sim_avg_label: 'Genomsnittligt omdöme',
      sim_total_title: 'Total nivå',
      sim_total_sub: 'Kombination av volym + kvalitet',
      sim_score_label: 'Förtroende (1–5)',
      sim_pcount_label: 'Fyllda P',
      sim_tip: 'Tips: Prova låg volym + högt snitt (få men bra) vs hög volym + medel (många men ojämnt).',

      globe_title: 'Ett globalt lager av trust.',
      globe_lead: 'En enkel och delbar signal som visar hur pålitlig du är i P2P – baserat på riktiga, verifierade affärer.',
      kpi_metric: 'Nyckeltal',
      kpi_value: 'Värde',
      kpi_note: 'Not',
      k1: 'Registrerade användare',
      k1n: 'Early access / MVP',
      k2: 'Verifierade transaktioner',
      k2n: 'Importerade + inskickade',
      k3: 'Omdömen / betyg',
      k3n: 'Kopplade till identiteter',
      k4: 'Plattformar kopplade',
      k4n: 'Mer kommer',

      // ✅ RATE HUB (DINA NYA NYCKLAR i rate.html)
      rate_hub_h1: 'Lämna betyg – via verifierad affär',
      rate_hub_lead:
        'För att undvika spam och manipulation kan du bara lämna betyg när vi kan koppla det till en avslutad affär. Välj hur du vill verifiera.',
      rate_method_title: 'Steg 1: Välj verifieringsmetod',
      rate_method_platform_title: 'Plattform (snabbast)',
      rate_method_platform_lead: 'Öppna plattformen → hitta avslutad affär → klicka på extensionen → kom tillbaka hit.',
      rate_method_choose_platform: 'Välj',
      rate_method_email_title: 'E-post/kvitton (automatiskt framöver)',
      rate_method_email_lead: 'Koppla din inkorg så kan vi hitta avslutade affärer och ge dig färdiga betygsförslag.',
      rate_method_choose_email: 'Visa',

      rate_platform_title: 'Steg 2: Starta från en plattform',
      rate_platform_lead:
        'Välj plattform och typ av affär. Vi öppnar plattformen – du letar upp den avslutade affären och klickar på extensionen.',
      rate_platform_label: 'Plattform',
      rate_platform_pick: 'Välj plattform…',
      rate_platform_flow_label: 'Typ av affär',
      rate_platform_flow_pick: 'Välj…',
      rate_platform_flow_buy: 'Köp',
      rate_platform_flow_sell: 'Sälj',
      rate_platform_flow_booking: 'Bokning/hyra',
      rate_platform_flow_other: 'Annat',
      rate_platform_go: 'Öppna plattform',
      rate_platform_note:
        'Tips: När du skickat från extensionen kommer du tillbaka hit med “Verifierad källa” ifyllt.',

      rate_email_title: 'Steg 2: Verifiera via e-post/kvitton',
      rate_email_lead:
        'Kommer snart: Koppla Gmail/Outlook så kan vi automatiskt identifiera avslutade affärer och skapa betygsförslag.',
      rate_email_connect: 'Koppla inkorg',
      rate_email_note: 'Under tiden: använd plattformsflödet (snabbast).',

      rate_verified_title: 'Verifierade affärer',
      rate_verified_lead:
        'Här kommer dina identifierade avslutade affärer att synas. Därifrån kan du lämna betyg.',

      rate_login_title: 'Logga in',
      rate_login_lead: 'Logga in med den e-post och det lösenord du registrerade dig med.',
      rate_login_email_label: 'E-post',
      rate_login_password_label: 'Lösenord',
      rate_login_password_ph: 'Ditt lösenord',
      rate_login_btn: 'Logga in',
      rate_signup: 'Registrera dig',

      footer_profile: 'Profil',
      footer_ask: 'Fråga om trust',
    },

    en: {
      top_sub: 'Reputation you can prove',

      // ✅ Top menu (universal)
      menu_home: 'Home',
      menu_how: 'How it works',
      menu_sim: 'See the value',
      menu_globe: 'Global trust',
      menu_rate: 'Leave a rating',
      menu_signup: 'Sign up',
      menu_profile: 'My profile',
      menu_extension: 'Install extension',
      menu_workrefs: 'Work references',
      menu_ask: 'See the 5P model',
      user_logout: 'Log out',

      profile_workrefs_title: 'Work References',
      profile_workrefs_lead: 'Collect and share verifiable references from employers and assignments.',
      profile_workrefs_btn: 'Open work references',

      menu_refs: 'Work References',
      work_refs_title: 'Work References',
      work_refs_lead: 'Collect and showcase verified work references from managers, colleagues, and clients.',
      work_refs_open: 'Open work references',
      work_refs_invite: 'Invite a reference',
      work_refs_status_title: 'Status',
      work_refs_status_body:
        '(Demo) Your references will be listed here. Next step is connecting this to LinkedIn sign-in and a simple “request a reference” flow.',

      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Reputation you can prove.',
      hero_p: 'PeerRate helps you carry verified reputation between marketplaces. Not vibes. Not claims. Transactions — portable and hard to fake.',
      hero_cta_primary: 'Get started',
      hero_cta_secondary: 'Log in',
      hero_card_title: 'A reputation card you can share',
      hero_card_p: 'A compact proof of how you behave in P2P — across platforms.',
      hero_metric_score: 'Trust (1–5)',
      hero_metric_tx: 'Verified transactions',

      how_title: 'For people online who want real trust.',
      how_lead: 'PeerRate standardizes reviews and links them to real transactions — making trust measurable, portable and fair.',
      f1_title: 'Verified',
      f1_p: 'Connect reputation to real transactions. Less fraud, fewer bad surprises.',
      f2_title: 'Portable',
      f2_p: 'Bring your trust score across marketplaces instead of starting from zero.',
      f3_title: 'Explainable',
      f3_p: 'A clear breakdown of what affects your score — not a black box.',

      sim_title: 'See the value instantly.',
      rep_trust: 'Trust (1–5)',
      rep_tx: 'Verified transactions',
      rep_plat: 'Platforms connected',
      rep_tap: 'Tap',
      rep_explain: 'Explanation',
      rep_btn: 'Open my profile',
      rep_btn2: 'Explain my trust',

      back_title: 'Why this level?',
      back_p: 'Trust is based on verified transactions, rating quality, recency and risk signals. The goal is portable trust that’s hard to fake.',
      back_b1: 'Verified history',
      back_t1: 'More verified transactions increases confidence.',
      back_b2: 'Consistency',
      back_t2: 'Stable positive behavior over time is rewarded.',
      back_b3: 'Risk signals',
      back_t3: 'Disputes and suspicious patterns can reduce the level.',
      back_btn: 'Back',
      back_btn2: 'Ask more',

      sim_h3: 'What happens when more people leave reviews — and they are good?',
      sim_p: 'Two sliders control the total level. Few reviews + low average gives a low level. Many reviews + high average gives 5P.',
      sim_count_label: 'Number of reviews',
      sim_avg_label: 'Average rating',
      sim_total_title: 'Total level',
      sim_total_sub: 'Volume + quality combined',
      sim_score_label: 'Trust (1–5)',
      sim_pcount_label: 'Filled P',
      sim_tip: 'Tip: Try low volume + high average (few but great) vs high volume + medium (many but mixed).',

      globe_title: 'A global layer of trust.',
      globe_lead: 'A simple, shareable signal showing how reliable you are in P2P — based on real, verified transactions.',
      kpi_metric: 'Metric',
      kpi_value: 'Value',
      kpi_note: 'Note',
      k1: 'Registered users',
      k1n: 'Early access / MVP',
      k2: 'Verified transactions',
      k2n: 'Imported + user submitted',
      k3: 'Reviews / ratings',
      k3n: 'Linked to identities',
      k4: 'Platforms connected',
      k4n: 'More coming',

      // ✅ RATE HUB (DINA NYA NYCKLAR i rate.html)
      rate_hub_h1: 'Leave a rating — via a verified transaction',
      rate_hub_lead:
        'To avoid spam and manipulation, you can only leave ratings when we can link them to a completed deal. Choose how you want to verify.',
      rate_method_title: 'Step 1: Choose verification method',
      rate_method_platform_title: 'Platform (fastest)',
      rate_method_platform_lead: 'Open the platform → find the completed deal → click the extension → come back here.',
      rate_method_choose_platform: 'Choose',
      rate_method_email_title: 'Email/receipts (automatic later)',
      rate_method_email_lead: 'Connect your inbox and we can detect completed deals and suggest ratings.',
      rate_method_choose_email: 'Show',

      rate_platform_title: 'Step 2: Start from a platform',
      rate_platform_lead:
        'Choose platform and deal type. We open the platform — you find the completed deal and click the extension.',
      rate_platform_label: 'Platform',
      rate_platform_pick: 'Choose platform…',
      rate_platform_flow_label: 'Deal type',
      rate_platform_flow_pick: 'Choose…',
      rate_platform_flow_buy: 'Buy',
      rate_platform_flow_sell: 'Sell',
      rate_platform_flow_booking: 'Booking/rent',
      rate_platform_flow_other: 'Other',
      rate_platform_go: 'Open platform',
      rate_platform_note:
        'Tip: After sending from the extension, you will return here with “Verified source” filled in.',

      rate_email_title: 'Step 2: Verify via email/receipts',
      rate_email_lead:
        'Coming soon: Connect Gmail/Outlook and we will automatically identify completed deals and create rating suggestions.',
      rate_email_connect: 'Connect inbox',
      rate_email_note: 'Meanwhile: use the platform flow (fastest).',

      rate_verified_title: 'Verified deals',
      rate_verified_lead:
        'Your identified completed deals will appear here. From there you can leave a rating.',

      rate_login_title: 'Log in',
      rate_login_lead: 'Log in with the email and password you used when signing up.',
      rate_login_email_label: 'Email',
      rate_login_password_label: 'Password',
      rate_login_password_ph: 'Your password',
      rate_login_btn: 'Log in',
      rate_signup: 'Sign up',

      footer_profile: 'Profile',
      footer_ask: 'Ask about trust',
    }
  };

  const LS_LANG = 'peerRateLang_v1';

  function applyLang(lang) {
    const d = dict[lang] || dict.sv;

    document.documentElement.lang = (lang === 'en') ? 'en' : 'sv';
    langLabel.textContent = (lang === 'en') ? 'EN' : 'SV';

    // 1) Normal text nodes (data-i18n)
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      const key = n.getAttribute('data-i18n');
      if (!key) return;
      if (d[key] != null) n.textContent = d[key];
    });

    // 2) Placeholders (data-i18n-placeholder)
    document.querySelectorAll('[data-i18n-placeholder]').forEach((n) => {
      const key = n.getAttribute('data-i18n-placeholder');
      if (!key) return;
      if (d[key] != null) n.setAttribute('placeholder', d[key]);
    });

    localStorage.setItem(LS_LANG, lang);
  }

  let open = false;
  const setMenuOpen = (v) => {
    open = v;
    langMenu.style.display = open ? 'block' : 'none';
    langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  langBtn.addEventListener('click', () => setMenuOpen(!open));
  langMenu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-lang]');
    if (!b) return;
    applyLang(b.getAttribute('data-lang'));
    setMenuOpen(false);
  });

  window.addEventListener('click', (e) => {
    if (!open) return;
    if (e.target.closest('#langBtn') || e.target.closest('#langMenu')) return;
    setMenuOpen(false);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenuOpen(false);
  });

  applyLang(localStorage.getItem(LS_LANG) || 'en');
}