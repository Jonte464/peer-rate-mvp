// frontend/modules/landing/language.js

export function initLandingLanguage() {
  const langBtn = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');
  const langLabel = document.getElementById('langLabel');

  // Om top-row inte finns (än), gör inget. pageBootstrap injectar den först.
  if (!langBtn || !langMenu || !langLabel) return;

  // -----------------------------
  // Dictionary
  // -----------------------------
  const dict = {
    sv: {
      top_sub: 'Förtroende du kan bevisa',
      menu_how: 'Hur det funkar',
      menu_sim: 'Se värdet direkt',
      menu_globe: 'Global trust',
      menu_rate: 'Lämna betyg',
      menu_signup: 'Registrera dig',
      menu_profile: 'Min profil',
      menu_ask: 'Fråga om trust',
      user_logout: 'Logga ut',

      // ✅ Arbetsreferenser
      menu_refs: 'Arbetsreferenser',
      profile_workrefs_title: 'Arbetsreferenser',
      profile_workrefs_lead: 'Samla och dela verifierbara referenser från uppdrag och arbetsgivare.',
      profile_workrefs_btn: 'Öppna arbetsreferenser',
      work_refs_title: 'Arbetsreferenser',
      work_refs_lead: 'Samla och visa verifierade arbetsreferenser från chefer, kollegor och uppdragsgivare.',
      work_refs_open: 'Öppna arbetsreferenser',
      work_refs_invite: 'Bjud in en referens',
      work_refs_status_title: 'Status',
      work_refs_status_body:
        '(Demo) Här kommer dina referenser att listas. Nästa steg är att koppla detta till LinkedIn-inloggning och ett enkelt “be om referens”-flöde.',

      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Förtroende du kan bevisa.',
      hero_p:
        'PeerRate gör att du kan bära med dig verifierad trovärdighet mellan marknadsplatser. Inte känsla. Inte påståenden. Riktiga transaktioner — portabelt och svårt att fejka.',
      hero_cta_primary: 'Kom igång',
      hero_cta_secondary: 'Logga in',
      hero_card_title: 'Ett reputation card du kan dela',
      hero_card_p: 'Ett kompakt kvitto på hur du agerar i P2P — över plattformar.',
      hero_metric_score: 'Förtroende (1–5)',
      hero_metric_tx: 'Verifierade transaktioner',

      how_title: 'En snabbfil för människor online.',
      how_lead:
        'PeerRate standardiserar betyg och kopplar dem till riktiga affärer — så att förtroende blir mätbart, portabelt och rättvist.',
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
      back_p:
        'Förtroendet bygger på verifierade transaktioner, kvalitet i omdömen, aktualitet och risksignaler. Målet är att göra förtroende portabelt och svårt att fejka.',
      back_b1: 'Verifierad historik',
      back_t1: 'Fler verifierade affärer höjer säkerheten.',
      back_b2: 'Stabilitet',
      back_t2: 'Jämn positiv historik över tid belönas.',
      back_b3: 'Risksignaler',
      back_t3: 'Dispyter och mönster kan sänka nivån.',
      back_btn: 'Tillbaka',
      back_btn2: 'Fråga mer',

      sim_h3: 'Vad händer när fler lämnar omdömen – och de är bra?',
      sim_p:
        'Två reglage styr den totala nivån. Få omdömen + lågt snitt ger låg nivå. Många omdömen + högt snitt ger 5P.',
      sim_count_label: 'Antal omdömen',
      sim_avg_label: 'Genomsnittligt omdöme',
      sim_total_title: 'Total nivå',
      sim_total_sub: 'Kombination av volym + kvalitet',
      sim_score_label: 'Förtroende (1–5)',
      sim_pcount_label: 'Fyllda P',
      sim_tip:
        'Tips: Prova låg volym + högt snitt (få men bra) vs hög volym + medel (många men ojämnt).',

      globe_title: 'Ett globalt lager av trust.',
      globe_lead:
        'En enkel och delbar signal som visar hur pålitlig du är i P2P – baserat på riktiga, verifierade affärer.',
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

      // profile
      profile_badge_label: 'Inloggad som',
      profile_h1: 'Min profil',
      profile_lead: 'Här kan du se dina uppgifter och ditt samlade omdöme.',
      profile_login_title: 'Logga in',
      profile_login_lead: 'Logga in med den e-post och det lösenord du registrerade dig med.',
      profile_login_email: 'E-post',
      profile_login_password: 'Lösenord',
      profile_login_btn: 'Logga in',
      profile_my_rating_title: 'Mitt omdöme',
      profile_my_rating_lead: 'Sammanfattning av betyg som är kopplade till din e-postadress.',
      profile_rating_sources_title: 'Varifrån kommer dina omdömen?',
      profile_no_ratings: 'Inga omdömen',
      profile_pr_rating_title: 'Din PeerRate-rating',
      profile_avg_label: 'Snittbetyg:',
      profile_based_on: 'baserat på',
      profile_reviews: 'omdömen',
      profile_my_details_title: 'Mina uppgifter',
      profile_my_details_lead: 'Uppgifter kopplade till din profil.',
      profile_avatar_upload: 'Ladda upp profilbild',
      profile_avatar_note: 'Bilden sparas bara lokalt i din webbläsare och kopplas till “Inloggad som”.',
      profile_logout_btn: 'Logga ut',

      profile_label_name: 'Namn',
      profile_label_email: 'E-post',
      profile_label_personalNumber: 'Personnummer',
      profile_label_phone: 'Telefon',
      profile_label_addressStreet: 'Gatuadress',
      profile_label_addressZip: 'Postnummer',
      profile_label_addressCity: 'Ort',
      profile_label_country: 'Land',

      profile_external_title: 'Externa data',
      profile_external_lead:
        'Här visas viss information som hämtats från externa, offentliga källor kopplat till din profil. Uppgifterna uppdateras automatiskt med jämna mellanrum.',
      profile_external_vehicles: 'Fordon (antal)',
      profile_external_properties: 'Fastigheter (antal)',
      profile_external_last_updated: 'Senast uppdaterad',
      profile_external_validated_address: 'Validerad adress',
      profile_external_address_status: 'Adressstatus',

      // customer
      customer_h1: 'Registrera dig',
      customer_lead:
        'Skapa ett konto och börja samla verifierad trust som du kan bära mellan marknadsplatser.',
      customer_step1_title: 'Steg 1: Skapa konto',
      customer_email_label: 'E-post',
      customer_email_ph: 'du@example.com',
      customer_password_label: 'Lösenord',
      customer_password_ph: 'Minst 8 tecken',
      customer_password2_label: 'Upprepa lösenord',
      customer_password2_ph: 'Upprepa lösenord',
      customer_terms_text:
        'Jag godkänner villkoren och integritetspolicyn och att trust kan baseras på verifierade transaktioner.',
      customer_register_btn: 'Registrera',

      customer_step2_title: 'Steg 2: Komplettera profil',
      customer_step2_note: 'Detta krävs för att din profil ska bli “complete”.',
      customer_cp_email_label: 'E-post (låst)',
      customer_first_name: 'Förnamn',
      customer_last_name: 'Efternamn',
      customer_personal_number: 'Personnummer',
      customer_personal_number_ph: 'YYYYMMDD-XXXX',
      customer_address: 'Adress',
      customer_address_ph: 'Gata och nummer',
      customer_postal_code: 'Postnummer',
      customer_postal_code_ph: '123 45',
      customer_city: 'Ort',
      customer_phone: 'Telefon (valfritt)',
      customer_phone_ph: '+46...',
      customer_save_continue: 'Spara & fortsätt',
      customer_skip: 'Hoppa över (ej rekommenderat)',

      customer_side_title: 'Vad får du?',
      customer_side_body:
        '• En portabel trust-signal\n• Verifierad historik kopplad till affärer\n• En profil du kan använda mellan marknadsplatser\n\nNästa steg: Installera extensionen och börja verifiera affärer.',
      customer_install_ext: 'Installera extension',
      customer_my_profile: 'Min profil',

      footer_privacy: 'Privacy',
      footer_profile: 'Profil',
    },

    en: {
      top_sub: 'Reputation you can prove',
      menu_how: 'How it works',
      menu_sim: 'See the value',
      menu_globe: 'Global trust',
      menu_rate: 'Leave a rating',
      menu_signup: 'Sign up',
      menu_profile: 'My profile',
      menu_ask: 'See the 5P model',
      user_logout: 'Log out',

      menu_refs: 'Work References',
      profile_workrefs_title: 'Work References',
      profile_workrefs_lead: 'Collect and share verifiable references from employers and assignments.',
      profile_workrefs_btn: 'Open work references',
      work_refs_title: 'Work References',
      work_refs_lead: 'Collect and showcase verified work references from managers, colleagues, and clients.',
      work_refs_open: 'Open work references',
      work_refs_invite: 'Invite a reference',
      work_refs_status_title: 'Status',
      work_refs_status_body:
        '(Demo) Your references will be listed here. Next step is connecting this to LinkedIn sign-in and a simple “request a reference” flow.',

      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Reputation you can prove.',
      hero_p:
        'PeerRate helps you carry verified reputation between marketplaces. Not vibes. Not claims. Transactions — portable and hard to fake.',
      hero_cta_primary: 'Get started',
      hero_cta_secondary: 'Log in',
      hero_card_title: 'A reputation card you can share',
      hero_card_p: 'A compact proof of how you behave in P2P — across platforms.',
      hero_metric_score: 'Trust (1–5)',
      hero_metric_tx: 'Verified transactions',

      how_title: 'A fast lane for people online.',
      how_lead:
        'PeerRate standardizes reviews and links them to real deals — making trust measurable, portable and fair.',
      f1_title: 'Verified',
      f1_p: 'Connect reputation to transactions. Less fraud, fewer bad surprises.',
      f2_title: 'Portable',
      f2_p: 'Bring your trust score across marketplaces instead of starting from zero.',
      f3_title: 'Explainable',
      f3_p: 'A clear breakdown of what affects your score — not a black box.',

      sim_title: 'See the value.',
      rep_trust: 'Trust (1–5)',
      rep_tx: 'Verified transactions',
      rep_plat: 'Platforms connected',
      rep_tap: 'Tap',
      rep_explain: 'Explanation',
      rep_btn: 'Open my profile',
      rep_btn2: 'Explain my trust',

      back_title: 'Why this level?',
      back_p:
        'Trust is based on verified transactions, rating quality, recency and risk signals. The goal is portable trust that’s hard to fake.',
      back_b1: 'Verified history',
      back_t1: 'More verified transactions increases confidence.',
      back_b2: 'Consistency',
      back_t2: 'Stable positive behavior over time is rewarded.',
      back_b3: 'Risk signals',
      back_t3: 'Disputes and suspicious patterns can reduce the level.',
      back_btn: 'Back',
      back_btn2: 'Ask more',

      sim_h3: 'What happens when more people leave reviews — and they are good?',
      sim_p:
        'Two sliders control the total level. Few reviews + low average gives a low level. Many reviews + high average gives 5P.',
      sim_count_label: 'Number of reviews',
      sim_avg_label: 'Average rating',
      sim_total_title: 'Total level',
      sim_total_sub: 'Volume + quality combined',
      sim_score_label: 'Trust (1–5)',
      sim_pcount_label: 'Filled P',
      sim_tip:
        'Tip: Try low volume + high average (few but great) vs high volume + medium (many but mixed).',

      globe_title: 'A global layer of trust.',
      globe_lead:
        'A simple, shareable signal showing how reliable you are in P2P — based on real, verified transactions.',
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

      profile_badge_label: 'Signed in as',
      profile_h1: 'My profile',
      profile_lead: 'Here you can see your details and your combined reputation.',
      profile_login_title: 'Log in',
      profile_login_lead: 'Log in with the email and password you used when signing up.',
      profile_login_email: 'Email',
      profile_login_password: 'Password',
      profile_login_btn: 'Log in',
      profile_my_rating_title: 'My rating',
      profile_my_rating_lead: 'A summary of ratings linked to your email address.',
      profile_rating_sources_title: 'Where do your ratings come from?',
      profile_no_ratings: 'No ratings',
      profile_pr_rating_title: 'Your PeerRate rating',
      profile_avg_label: 'Average score:',
      profile_based_on: 'based on',
      profile_reviews: 'reviews',
      profile_my_details_title: 'My details',
      profile_my_details_lead: 'Details linked to your profile.',
      profile_avatar_upload: 'Upload profile picture',
      profile_avatar_note: 'The image is stored locally in your browser and used for “Signed in as”.',
      profile_logout_btn: 'Log out',

      profile_label_name: 'Name',
      profile_label_email: 'Email',
      profile_label_personalNumber: 'Personal number',
      profile_label_phone: 'Phone',
      profile_label_addressStreet: 'Street address',
      profile_label_addressZip: 'Postal code',
      profile_label_addressCity: 'City',
      profile_label_country: 'Country',

      profile_external_title: 'External data',
      profile_external_lead:
        'Some information fetched from external public sources linked to your profile. Data is updated automatically at intervals.',
      profile_external_vehicles: 'Vehicles (count)',
      profile_external_properties: 'Properties (count)',
      profile_external_last_updated: 'Last updated',
      profile_external_validated_address: 'Validated address',
      profile_external_address_status: 'Address status',

      customer_h1: 'Sign up',
      customer_lead:
        'Create an account and start collecting verified trust you can carry between marketplaces.',
      customer_step1_title: 'Step 1: Create account',
      customer_email_label: 'Email',
      customer_email_ph: 'you@example.com',
      customer_password_label: 'Password',
      customer_password_ph: 'At least 8 characters',
      customer_password2_label: 'Repeat password',
      customer_password2_ph: 'Repeat password',
      customer_terms_text:
        'I accept the terms and privacy policy, and that trust may be based on verified transactions.',
      customer_register_btn: 'Create account',

      customer_step2_title: 'Step 2: Complete profile',
      customer_step2_note: 'This is required for your profile to become “complete”.',
      customer_cp_email_label: 'Email (locked)',
      customer_first_name: 'First name',
      customer_last_name: 'Last name',
      customer_personal_number: 'Personal number',
      customer_personal_number_ph: 'YYYYMMDD-XXXX',
      customer_address: 'Address',
      customer_address_ph: 'Street and number',
      customer_postal_code: 'Postal code',
      customer_postal_code_ph: '123 45',
      customer_city: 'City',
      customer_phone: 'Phone (optional)',
      customer_phone_ph: '+46...',
      customer_save_continue: 'Save & continue',
      customer_skip: 'Skip (not recommended)',

      customer_side_title: 'What do you get?',
      customer_side_body:
        '• A portable trust signal\n• Verified history linked to deals\n• A profile you can use across marketplaces\n\nNext: Install the extension and start verifying deals.',
      customer_install_ext: 'Install extension',
      customer_my_profile: 'My profile',

      footer_privacy: 'Privacy',
      footer_profile: 'Profile',
    },
  };

  const LS_LANG = 'peerRateLang_v1';

  // -----------------------------
  // Apply translations
  // -----------------------------
  function applyLang(lang) {
    const d = dict[lang] || dict.sv;

    document.documentElement.lang = lang === 'en' ? 'en' : 'sv';
    langLabel.textContent = lang === 'en' ? 'EN' : 'SV';

    // 1) text nodes
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      const key = n.getAttribute('data-i18n');
      if (!key) return;
      if (d[key] != null) n.textContent = d[key];
    });

    // 2) placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach((n) => {
      const key = n.getAttribute('data-i18n-placeholder');
      if (!key) return;
      if (d[key] != null) n.setAttribute('placeholder', d[key]);
    });

    // 3) multiline text helper (optional): data-i18n-multiline => replace \n with <br/>
    document.querySelectorAll('[data-i18n-multiline]').forEach((n) => {
      const key = n.getAttribute('data-i18n-multiline');
      if (!key) return;
      if (d[key] != null) {
        const html = String(d[key]).replace(/\n/g, '<br/>');
        n.innerHTML = html;
      }
    });

    try {
      localStorage.setItem(LS_LANG, lang);
      // Exponera så andra moduler kan trigga re-apply om de vill
      window.__peerRateLang = lang;
    } catch {}
  }

  // Debounced apply (för MutationObserver)
  let applyTimer = null;
  function applyLangDebounced(lang) {
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => applyLang(lang), 60);
  }

  function getCurrentLang() {
    try {
      return localStorage.getItem(LS_LANG) || 'sv';
    } catch {
      return 'sv';
    }
  }

  // -----------------------------
  // Dropdown behaviour
  // -----------------------------
  let open = false;
  const setMenuOpen = (v) => {
    open = v;
    langMenu.style.display = open ? 'block' : 'none';
    langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  // stoppa eventet så det inte krockar med andra topRow-lyssnare
  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenuOpen(!open);
  });

  langMenu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-lang]');
    if (!b) return;
    const lang = b.getAttribute('data-lang') || 'sv';
    applyLang(lang);
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

  // -----------------------------
  // MutationObserver: re-apply when DOM changes
  // (för top-row injection + moduler som renderar senare)
  // -----------------------------
  if (!window.__peerRateLangObserverBound) {
    window.__peerRateLangObserverBound = true;

    const obs = new MutationObserver(() => {
      // re-apply current language after DOM mutations
      applyLangDebounced(getCurrentLang());
    });

    try {
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
  }

  // Default: previously selected language else SV
  applyLang(getCurrentLang());
}