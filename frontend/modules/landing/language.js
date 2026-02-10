// frontend/modules/landing/language.js
export function initLandingLanguage() {
  const langBtn = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');
  const langLabel = document.getElementById('langLabel');
  if (!langBtn || !langMenu || !langLabel) return;

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

      // ✅ NYTT: arbetsreferenser
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

      rate_login_title: 'Logga in',
      rate_login_lead: 'Logga in med den e-post och det lösenord du registrerade dig med innan du lämnar betyg.',
      rate_signup: 'Registrera dig',
      rate_title: 'Lämna ett betyg',

      rate_login_hint_pre: 'Du behöver logga in för att kunna lämna betyg. Logga in ovan eller ',
      rate_login_hint_link: 'registrera dig här',
      rate_login_hint_post: '.',

      rate_login_email_label: 'E-post',
      rate_login_password_label: 'Lösenord',
      rate_login_password_ph: 'Ditt lösenord',
      rate_login_btn: 'Logga in',

      rate_form_subject_label: 'Vem betygsätter du?',
      rate_form_subject_note: '(användarnamn eller mejl)',
      rate_form_rater_label: 'Ditt namn/mejl',
      rate_form_rater_note: '(valfritt – om du är inloggad fylls din e-post i automatiskt)',
      rate_form_score_label: 'Betyg (1–5)',
      rate_form_score_pick: 'Välj betyg',
      rate_form_source_label: 'Varifrån kommer betyget?',
      rate_form_optional: '(valfritt)',
      rate_form_source_pick: 'Välj källa (valfritt)',

      footer_profile: 'Profil',
      footer_ask: 'Fråga om trust',

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

      rate_page_h1: 'Lämna ett betyg – snabbt, enkelt och verifierbart',
      rate_page_lead:
        'PeerRate hjälper dig att samla omdömen som du kan visa upp – oavsett plattform. När fler omdömen kopplas till verifierade affärer blir din PeerRate-rating starkare.',

      rate_page_b1_title: '1) Logga in',
      rate_page_b1_text: 'Så kan vi koppla betyget till dig och minska spam.',
      rate_page_b2_title: '2) Sätt betyg',
      rate_page_b2_text: 'Ge 1–5 och lämna en kort kommentar (valfritt).',
      rate_page_b3_title: '3) Lägg verifiering',
      rate_page_b3_text: 'Om du vill kan du ange order-ID/annonslänk för starkare trovärdighet.',

      rate_faq_title: 'FAQ',
      rate_faq_q1: 'Måste jag logga in?',
      rate_faq_a1: 'Ja, för att minska spam och kunna koppla betyg till en riktig användare.',
      rate_faq_q2: 'Är kommentaren obligatorisk?',
      rate_faq_a2: 'Nej. Du kan lämna bara ett betyg. Kommentar gör oftast omdömet mer användbart.',
      rate_faq_q3: 'Vad är “Verifierings-ID”?',
      rate_faq_a3: 'Det är ett valfritt referensnummer som kan stärka trovärdigheten, t.ex. ordernummer eller annons-ID.',
      rate_faq_q4: 'Vad händer om jag rapporterar misstänkt bedrägeri?',
      rate_faq_a4: 'Då flaggas betyget för granskning. Vi kan kontakta dig om vi behöver mer info.'
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

      // ✅ NEW: work references
      menu_refs: 'Work References',
      work_refs_title: 'Work References',
      work_refs_lead: 'Collect and showcase verified work references from managers, colleagues, and clients.',
      work_refs_open: 'Open work references',
      work_refs_invite: 'Invite a reference',
      work_refs_status_title: 'Status',
      work_refs_status_body: '(Demo) Your references will be listed here. Next step is connecting this to LinkedIn sign-in and a simple “request a reference” flow.',

      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Reputation you can prove.',
      hero_p: 'PeerRate helps you carry verified reputation between assignments. Not vibes. Not claims. Transactions — portable and hard to fake.',
      hero_cta_primary: 'Get started',
      hero_cta_secondary: 'Log in',
      hero_card_title: 'A reputation card you can share',
      hero_card_p: 'A compact proof of how you behave in P2P — across platforms.',
      hero_metric_score: 'Trust (1–5)',
      hero_metric_tx: 'Verified transactions',

      how_title: 'For consultants who want to show real trust, not just a CV.',
      how_lead: 'PeerRate standardizes reviews and links them to assignments — making trust measurable, portable and fair.',
      f1_title: 'Verified',
      f1_p: 'Connect reputation to transactions. Less fraud, fewer bad surprises.',
      f2_title: 'Portable',
      f2_p: 'Bring your trust score across assignments instead of starting from zero.',
      f3_title: 'Explainable',
      f3_p: 'A clear breakdown of what affects your score — not a black box.',

      sim_title: 'But it is not only about reviews, we look at the big picture.',
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

      rate_login_title: 'Log in',
      rate_login_lead: 'Log in with the email and password you used when signing up before leaving a rating.',
      rate_signup: 'Sign up',
      rate_title: 'Leave a rating',

      rate_login_hint_pre: 'You need to log in to leave a rating. Log in above or ',
      rate_login_hint_link: 'sign up here',
      rate_login_hint_post: '.',

      rate_login_email_label: 'Email',
      rate_login_password_label: 'Password',
      rate_login_password_ph: 'Your password',
      rate_login_btn: 'Log in',

      rate_form_subject_label: 'Who are you rating?',
      rate_form_subject_note: '(username or email)',
      rate_form_rater_label: 'Your name/email',
      rate_form_rater_note: '(optional — if you are logged in, your email is filled in automatically)',
      rate_form_score_label: 'Rating (1–5)',
      rate_form_score_pick: 'Choose rating',
      rate_form_source_label: 'Where is the rating from?',
      rate_form_optional: '(optional)',
      rate_form_source_pick: 'Choose source (optional)',

      footer_profile: 'Profile',
      footer_ask: 'Ask about trust',

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

      rate_page_h1: 'Leave a review — quick, simple, and verifiable',
      rate_page_lead:
        'PeerRate helps you collect reviews you can show anywhere — regardless of platform. As more reviews get linked to verified transactions, your PeerRate rating becomes stronger.',

      rate_page_b1_title: '1) Log in',
      rate_page_b1_text: 'So we can link the review to a real user and reduce spam.',
      rate_page_b2_title: '2) Set a rating',
      rate_page_b2_text: 'Choose 1–5 and optionally add a short comment.',
      rate_page_b3_title: '3) Add verification',
      rate_page_b3_text: 'Optionally add an order ID/listing link to strengthen credibility.',

      rate_faq_title: 'FAQ',
      rate_faq_q1: 'Do I have to log in?',
      rate_faq_a1: 'Yes — to reduce spam and link reviews to a real account.',
      rate_faq_q2: 'Is the comment required?',
      rate_faq_a2: 'No. You can submit a rating only. A comment usually makes the review more helpful.',
      rate_faq_q3: 'What is “Verification ID”?',
      rate_faq_a3: 'An optional reference that can strengthen credibility, e.g. an order number or listing ID.',
      rate_faq_q4: 'What happens if I report suspected fraud?',
      rate_faq_a4: 'The review is flagged for review. We may contact you if we need more information.'
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
