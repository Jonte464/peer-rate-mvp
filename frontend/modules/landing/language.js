// frontend/modules/landing/language.js

const LS_LANG = 'peerRateLang_v1';
const DEFAULT_LANG = 'en';

const dict = {
  sv: {
    top_sub: 'Förtroende du kan bevisa',

    menu_home: 'Hem',
    menu_how: 'Hur det funkar',
    menu_sim: 'Se värdet direkt',
    menu_globe: 'Global trust',
    menu_rate: 'Lämna betyg',
    menu_signup: 'Registrera dig',
    menu_profile: 'Min profil',
    menu_ask: 'Fråga om trust',
    menu_extension: 'Installera extension',
    menu_workrefs: 'Arbetsreferenser',
    user_logout: 'Logga ut',

    top_user_aria: 'Konto',
    lang_menu_aria: 'Välj språk',
    menu_open_aria: 'Öppna meny',
    menu_panel_aria: 'Meny',

    // Arbetsreferenser
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

    // Landing
    hero_kicker: 'Peer-to-peer reputation',
    hero_h1: 'Förtroende du kan bevisa.',
    hero_p:
      'PeerRate gör att du kan bära med dig verifierad trovärdighet mellan marknadsplatser. Inte känsla. Inte påståenden. Riktiga transaktioner — portabelt och svårt att fejka.',
    hero_cta_primary: 'Kom igång',
    hero_cta_secondary: 'Logga in',
    hero_cta_signup: 'Registrera dig',
    hero_cta_rate: 'Lämna betyg',
    hero_cta_refs: 'Arbetsreferenser',
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

    // Extension
    ext_meta_title: 'PeerRate – Installera Extension',
    ext_meta_description:
      'Installera PeerRate Extension och lämna verifierade omdömen på Tradera, med fler plattformar på väg.',
    ext_kicker: 'Verifierad affärsdata',
    ext_h1: 'Installera PeerRate Extension',
    ext_lead:
      'PeerRate gör det möjligt att lämna verifierade omdömen baserat på verkliga affärer från plattformar som Tradera, och snart Blocket och fler. Extensionen identifierar affären, skickar verifierad affärsdata till PeerRate och låter dig lämna ett omdöme på några sekunder.',
    ext_badge_tradera: 'Tradera: Live',
    ext_badge_blocket: 'Blocket: Näst på tur',
    ext_badge_others: 'eBay / Airbnb: Planerat',
    ext_cta_store: 'Installera Chrome Extension',
    ext_cta_manual: 'Installera manuellt (beta)',
    ext_cta_how: 'Se hur det fungerar',
    ext_note_label: 'Obs:',
    ext_note_body:
      'Om knappen ovan ännu inte leder till Chrome Web Store kan du använda den manuella beta-installationen längre ned.',
    ext_result_title: '✅ Resultatet',
    ext_result_body:
      'Du lämnar ett omdöme som är kopplat till en verklig affär via proofRef, vilket gör det mer trovärdigt än anonyma reviews.',
    ext_privacy_title: '🔒 Privacy',
    ext_privacy_body:
      'PeerRate sparar bara de affärsfält som behövs för verifiering plus ditt omdöme. Inga lösenord eller betaluppgifter sparas.',
    ext_fast_title: '⚡ Snabbt',
    ext_fast_body:
      'Öppna en genomförd affär, klicka “Betygsätt med PeerRate”, och rate.html fylls med verifierad data medan formuläret låses.',
    ext_how_title: 'Hur det fungerar',
    ext_how_sub: '4 steg',
    ext_step1_title: 'Installera extensionen',
    ext_step1_body:
      'Installera via Chrome Web Store när den finns publicerad, eller manuellt i developer mode under beta.',
    ext_step2_title: 'Öppna din genomförda affär',
    ext_step2_body:
      'Gå till en sida som visar en avslutad transaktion på Tradera, och senare Blocket och andra plattformar.',
    ext_step3_title: 'Klicka “Betygsätt”',
    ext_step3_body:
      'Extensionen identifierar affären och skapar en verifierad payload till PeerRate.',
    ext_step4_title: 'Lämna ditt omdöme',
    ext_step4_body:
      'Du landar på rate.html med en verifierad affär, och det låsta formuläret gör att du kan skicka in tryggt.',
    ext_platforms_title: 'Stödda plattformar',
    ext_platforms_sub: 'Status',
    ext_platform_tradera_body: 'Verifiering via proofRef + affärsdata',
    ext_platform_blocket_body: 'MVP: proofRef = pageUrl när orderId saknas',
    ext_platform_others_body: 'Parser-baserad roadmap',
    ext_live: 'LIVE',
    ext_next: 'NÄST',
    ext_planned: 'PLANERAT',
    ext_tip_label: 'Tips:',
    ext_tip_body:
      'För att kunna skala snabbt bygger vi en parser-arkitektur där varje plattform kan få sin egen parser.',
    ext_privacy_section_title: 'Privacy & säkerhet',
    ext_privacy_section_sub: 'Trust by design',
    ext_privacy_li1:
      'Ingen inloggning i extensionen: du loggar in på PeerRate om du inte redan är inloggad.',
    ext_privacy_li2:
      'Inga lösenord: extensionen läser inte och sparar inte inloggningsuppgifter.',
    ext_privacy_li3:
      'Minimerad data: bara de fält som behövs för verifiering skickas, till exempel title, date, amount, proofRef och pageUrl.',
    ext_privacy_li4:
      'Duplicate-skydd: backend har en unik constraint på platform + externalProofRef.',
    ext_privacy_footer:
      'Den här texten kan senare delas upp i en kortare produktversion och en mer formell legal version.',
    ext_manual_title: 'Installera manuellt (beta)',
    ext_manual_sub: 'För när Chrome Web Store-länken ännu inte är publicerad',
    ext_manual_lead:
      'Detta är standardflödet för att testa en Chrome extension lokalt. När Web Store-listningen är publicerad blir detta istället en 1-klicksinstallation.',
    ext_manual_step1_title: 'Ladda ner extension-koden',
    ext_manual_step1_body:
      'Ladda ner den från ert GitHub-repo eller som en hostad zip-fil.',
    ext_manual_step2_title: 'Öppna Chrome Extensions',
    ext_manual_step2_body:
      'Gå till chrome://extensions och slå på Developer mode.',
    ext_manual_step3_title: 'Load unpacked',
    ext_manual_step3_body:
      'Klicka Load unpacked och välj mappen extension/.',
    ext_copy_title: 'Copy-paste för Chrome-adressfältet',
    ext_copy_sub: 'Detta öppnar extensions-sidan direkt.',
    ext_copy_btn: 'Kopiera: chrome://extensions',
    ext_codebox:
      '1) Öppna chrome://extensions\n2) Aktivera "Developer mode" uppe till höger\n3) Klicka "Load unpacked"\n4) Välj mappen: extension/',
    ext_protip_label: 'Protip:',
    ext_protip_body:
      'När ni har en zip kan ni hosta den under /downloads/peerrate-extension.zip och länka hit från sidan.',
    ext_test_title: 'Testa extensionen',
    ext_test_sub: 'Snabb check',
    ext_test_li1: 'Installera extensionen via Web Store eller manuellt.',
    ext_test_li2: 'Öppna en genomförd affär på Tradera.',
    ext_test_li3: 'Klicka “Betygsätt med PeerRate”.',
    ext_test_li4:
      'Du landar på /rate.html?pr=... och ser en verifierad affär med ett låst formulär.',
    ext_test_li5:
      'Skicka in och verifiera att framgångstoasten visas.',
    ext_test_cta_rate: 'Öppna rate.html',
    ext_test_cta_top: 'Till toppen',
    ext_footer_tagline: 'Verifierade omdömen – byggda för tillit',
    ext_toast_default: 'Kopierat!',
    ext_toast_copy_success: 'Kopierat: chrome://extensions',
    ext_toast_copy_fail:
      'Kunde inte kopiera. Din webbläsare kanske blockerar clipboard-åtkomst.',

    // Rate page
    rate_kicker: 'Verifierat betygsflöde',
    rate_hub_h1: 'Lämna betyg – via verifierad affär',
    rate_hub_lead:
      'För att undvika spam och manipulation kan du bara lämna betyg när vi kan koppla det till en avslutad affär. Välj hur du vill verifiera.',
    rate_side_verified_title: 'Varför verifierad affär?',
    rate_side_verified_body:
      'PeerRate bygger på att omdömen kopplas till riktiga avslutade transaktioner, inte öppna formulär utan bevis.',
    rate_side_flow_title: 'Hur flödet ser ut',
    rate_side_flow_body:
      'Välj plattform, öppna den avslutade affären, skicka verifierad data från extensionen och lämna sedan ditt omdöme här.',
    rate_side_future_title: 'På väg framåt',
    rate_side_future_body:
      'Nästa steg är automatiska verifieringar via e-post, kvitton och fler plattformar.',

    rate_method_title: 'Steg 1: Välj verifieringsmetod',
    rate_method_platform_title: 'Plattform (snabbast)',
    rate_method_platform_lead:
      'Öppna plattformen → hitta avslutad affär → klicka på extensionen → kom tillbaka hit.',
    rate_method_choose_platform: 'Välj',
    rate_method_email_title: 'E-post/kvitton (automatiskt framöver)',
    rate_method_email_lead:
      'Koppla din inkorg så kan vi hitta avslutade affärer och ge dig färdiga betygsförslag.',
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
    rate_platform_how_label: 'Så gör du:',
    rate_platform_step1: 'Öppna plattformen.',
    rate_platform_step2: 'Hitta den avslutade affären, gärna order, receipt eller kvitto.',
    rate_platform_step3: 'Klicka på PeerRate-extensionen för att skicka verifierad info.',
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
    rate_verified_empty: 'Inga verifierade affärer än.',
    rate_verified_card_title: 'Verifierad affär',

    rate_context_title: 'Verifierad källa',
    rate_context_source_label: 'Källa:',
    rate_context_view_source: 'Visa sidan som triggar betyget →',
    rate_context_tip_title: 'Tips',
    rate_context_tip_body:
      'Nästa steg: När vi har hårda data som motpart, belopp och datum visar vi ett låst betygsformulär.',

    rate_login_title: 'Logga in',
    rate_login_lead:
      'Logga in med den e-post och det lösenord du registrerade dig med.',
    rate_login_email_label: 'E-post',
    rate_login_email_ph: 'erik@example.com',
    rate_login_password_label: 'Lösenord',
    rate_login_password_ph: 'Ditt lösenord',
    rate_login_forgot: 'Glömt ditt lösenord?',
    rate_login_btn: 'Logga in',
    rate_signup: 'Registrera dig',

    rate_step3_title: 'Steg 3: Lämna omdöme',
    rate_step3_lead:
      'Formuläret är låst till verifierad affär. Du kan bara välja betyg och skriva kommentar.',
    rate_score_label: 'Betyg',
    rate_pick_score: 'Välj…',
    rate_score_1: '1 – Mycket dåligt',
    rate_score_2: '2 – Dåligt',
    rate_score_3: '3 – Okej',
    rate_score_4: '4 – Bra',
    rate_score_5: '5 – Mycket bra',
    rate_comment_label: 'Kommentar (valfritt)',
    rate_comment_ph: 'Vad fungerade bra eller dåligt?',
    rate_submit_rating: 'Skicka omdöme',
    rate_submit_loading: 'Skickar…',

    rate_label_source: 'Källa',
    rate_label_order_proof: 'Order/Proof',
    rate_label_counterparty_email: 'Motpart (e-post)',
    rate_label_name: 'Namn',
    rate_label_phone: 'Telefon',
    rate_label_address: 'Adress',
    rate_label_amount: 'Belopp',
    rate_label_date: 'Datum',
    rate_view_source: 'Visa källan →',

    rate_error_login_required: 'Du måste logga in för att skicka omdöme.',
    rate_error_missing_counterparty: 'Motpart saknas i verifierad affär.',
    rate_error_pick_score: 'Välj ett betyg.',
    rate_error_duplicate: 'Omdöme har redan lämnats för denna affär.',
    rate_error_save: 'Kunde inte spara betyget.',
    rate_error_technical: 'Tekniskt fel. Försök igen om en stund.',

    rate_success_title: 'Tack för ditt omdöme! ✅',
    rate_success_body: 'Ditt omdöme är registrerat.',
    rate_success_next: 'Du kan nu stänga sidan eller gå till din profil.',
    rate_success_saved: 'Ditt omdöme är sparat.',
    rate_success_saved_toast: 'Tack! Ditt omdöme är sparat.',
    rate_go_profile: 'Gå till profil',
    rate_go_home: 'Till startsidan',

    // profile
    profile_badge_label: 'Inloggad som',
    profile_h1: 'Min profil',
    profile_lead: 'Här kan du se dina uppgifter och ditt samlade omdöme.',
    profile_login_title: 'Logga in',
    profile_login_lead: 'Logga in med den e-post och det lösenord du registrerade dig med.',
    profile_login_email: 'E-post',
    profile_login_password: 'Lösenord',
    profile_login_email_ph: 'erik@example.com',
    profile_login_password_ph: 'Ditt lösenord',
    profile_login_btn: 'Logga in',

    profile_my_rating_title: 'Mitt omdöme',
    profile_my_rating_lead: 'Sammanfattning av betyg som är kopplade till din e-postadress.',
    profile_rating_sources_title: 'Varifrån kommer dina omdömen?',
    profile_no_ratings: 'Inga omdömen',
    profile_no_ratings_yet: 'Inga omdömen ännu.',
    profile_no_ratings_short: 'Inga omdömen än.',
    profile_pr_rating_title: 'Din PeerRate-rating',
    profile_avg_label: 'Snittbetyg:',
    profile_based_on: 'baserat på',
    profile_reviews: 'omdömen',
    profile_current_rating: 'Din nuvarande rating är {value} / 5.',
    profile_total_ratings: '{count} omdömen',
    profile_my_details_title: 'Mina uppgifter',
    profile_my_details_lead: 'Uppgifter kopplade till din profil.',
    profile_avatar_upload: 'Ladda upp profilbild',
    profile_avatar_note: 'Bilden sparas bara lokalt i din webbläsare och kopplas till “Inloggad som”.',
    profile_avatar_title: 'Klicka för att byta bild',
    profile_logout_btn: 'Logga ut',
    profile_default_name: 'Profil',

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

    profile_address_status_verified: 'Bekräftad (adress hittad i adressregister)',
    profile_address_status_from_profile: 'Från din profil (ej verifierad externt)',
    profile_address_status_no_external_data: 'Ingen extern data',
    profile_address_status_no_address_input: 'Ingen adress angiven',
    profile_address_status_no_address_in_response: 'Ingen adress i svaret från tjänsten',
    profile_address_status_no_address: 'Ingen adress',
    profile_address_status_lookup_failed: 'Tekniskt fel vid adresskontroll',
    profile_address_status_unknown: 'Okänd status ({status})',

    profile_rating_source_other: 'Annat/okänt',
    profile_rating_source_blaget_fallback: 'Annat/okänt',
    profile_rating_by: 'av {name}',
    profile_rating_via: 'betyg via {source}',
    profile_rater_unknown: 'Okänd',

    profile_login_error_missing_fields: 'Fyll i både e-post och lösenord.',
    profile_login_error_failed: 'Inloggningen misslyckades. Kontrollera uppgifterna.',
    profile_login_success: 'Du är nu inloggad.',
    profile_login_error_technical: 'Tekniskt fel vid inloggning. Försök igen om en stund.',
    profile_logout_success: 'Du är nu utloggad.',
    profile_logout_error: 'Kunde inte logga ut. Försök igen.',

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

    customer_error_server_status: 'Serverfel (status {status})',
    customer_error_fill_email: 'Fyll i e-post.',
    customer_error_email_mismatch: 'E-postadresserna matchar inte.',
    customer_error_password_length: 'Lösenord måste vara minst 8 tecken.',
    customer_error_password_mismatch: 'Lösenorden matchar inte.',
    customer_error_terms_required: 'Du måste godkänna villkoren för att skapa konto.',
    customer_status_creating_account: 'Skapar konto…',
    customer_step1_success: 'Tack! Konto skapat.',
    customer_step1_success_continue: 'Konto skapat! Fortsätt med steg 2 nedan.',
    customer_step1_success_no_step2: 'Konto skapat! (Steg 2-form hittades inte på sidan – kontrollera att den finns i HTML.)',
    customer_error_timeout: 'Servern svarar inte (timeout). Försök igen.',
    customer_error_email_exists: 'Det finns redan ett konto med denna e-post.',
    customer_error_contact_server: 'Kunde inte kontakta servern. Försök igen.',
    customer_error_missing_step1_email: 'Saknar e-post från steg 1. Gör steg 1 först.',
    customer_error_first_name: 'Fyll i förnamn (minst 2 tecken).',
    customer_error_last_name: 'Fyll i efternamn (minst 2 tecken).',
    customer_error_personal_number: 'Fyll i personnummer.',
    customer_error_address: 'Fyll i adress.',
    customer_error_postal_code: 'Fyll i postnummer.',
    customer_error_city: 'Fyll i ort.',
    customer_status_saving_profile: 'Sparar profil…',
    customer_step2_success: 'Profil sparad!',
    customer_error_conflict: 'Konflikt: e-post/personnummer finns redan.',
    customer_error_save_profile: 'Kunde inte spara profilen. Försök igen.',

    footer_privacy: 'Privacy',
    footer_profile: 'Profil',
    footer_ask: 'Se 5P-modellen',
  },

  en: {
    top_sub: 'Reputation you can prove',

    menu_home: 'Home',
    menu_how: 'How it works',
    menu_sim: 'See the value',
    menu_globe: 'Global trust',
    menu_rate: 'Leave a rating',
    menu_signup: 'Sign up',
    menu_profile: 'My profile',
    menu_ask: 'See the 5P model',
    menu_extension: 'Install extension',
    menu_workrefs: 'Work references',
    user_logout: 'Log out',

    top_user_aria: 'Account',
    lang_menu_aria: 'Choose language',
    menu_open_aria: 'Open menu',
    menu_panel_aria: 'Menu',

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
    hero_cta_signup: 'Sign up',
    hero_cta_rate: 'Leave a rating',
    hero_cta_refs: 'Work references',
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

    ext_meta_title: 'PeerRate – Install Extension',
    ext_meta_description:
      'Install PeerRate Extension and leave verified ratings on Tradera, with more platforms coming.',
    ext_kicker: 'Verified deal capture',
    ext_h1: 'Install PeerRate Extension',
    ext_lead:
      'PeerRate makes it possible to leave verified ratings based on real deals from platforms like Tradera, and soon Blocket and more. The extension identifies the deal, sends verified deal data to PeerRate, and lets you rate in seconds.',
    ext_badge_tradera: 'Tradera: Live',
    ext_badge_blocket: 'Blocket: Next up',
    ext_badge_others: 'eBay / Airbnb: Planned',
    ext_cta_store: 'Install Chrome Extension',
    ext_cta_manual: 'Install manually (beta)',
    ext_cta_how: 'See how it works',
    ext_note_label: 'Note:',
    ext_note_body:
      'If the button above does not yet lead to Chrome Web Store, use the manual beta installation further down.',
    ext_result_title: '✅ The result',
    ext_result_body:
      'You leave a rating linked to a real deal via proofRef, which makes it more credible than anonymous reviews.',
    ext_privacy_title: '🔒 Privacy',
    ext_privacy_body:
      'PeerRate stores only the deal fields needed for verification plus your rating. No passwords or payment details are stored.',
    ext_fast_title: '⚡ Fast',
    ext_fast_body:
      'Open a completed deal, click “Rate with PeerRate”, and rate.html is prefilled with verified data while the form is locked.',
    ext_how_title: 'How it works',
    ext_how_sub: '4 steps',
    ext_step1_title: 'Install the extension',
    ext_step1_body:
      'Install via Chrome Web Store when available, or manually in developer mode during beta.',
    ext_step2_title: 'Open your completed deal',
    ext_step2_body:
      'Go to a page showing a completed transaction on Tradera, and later Blocket and other platforms.',
    ext_step3_title: 'Click “Rate”',
    ext_step3_body:
      'The extension identifies the deal and creates a verified payload for PeerRate.',
    ext_step4_title: 'Leave your rating',
    ext_step4_body:
      'You land on rate.html with a verified deal, and the locked form lets you submit safely.',
    ext_platforms_title: 'Supported platforms',
    ext_platforms_sub: 'Status',
    ext_platform_tradera_body: 'Verification via proofRef + deal data',
    ext_platform_blocket_body: 'MVP: proofRef = pageUrl when orderId is missing',
    ext_platform_others_body: 'Parser-based roadmap',
    ext_live: 'LIVE',
    ext_next: 'NEXT',
    ext_planned: 'PLANNED',
    ext_tip_label: 'Tip:',
    ext_tip_body:
      'To scale fast we are building a parser architecture where each platform can get its own parser.',
    ext_privacy_section_title: 'Privacy & security',
    ext_privacy_section_sub: 'Trust by design',
    ext_privacy_li1:
      'No login inside the extension: you log in on PeerRate if you are not already signed in.',
    ext_privacy_li2:
      'No passwords: the extension does not read or store credentials.',
    ext_privacy_li3:
      'Minimal data: only the fields needed for verification are sent, such as title, date, amount, proofRef and pageUrl.',
    ext_privacy_li4:
      'Duplicate protection: the backend has a unique constraint on platform + externalProofRef.',
    ext_privacy_footer:
      'This text can later be split into a shorter product version and a more formal legal version.',
    ext_manual_title: 'Install manually (beta)',
    ext_manual_sub: 'For when the Chrome Web Store link is not yet published',
    ext_manual_lead:
      'This is the standard flow for testing a Chrome extension locally. When the Web Store listing is published this becomes a one-click install instead.',
    ext_manual_step1_title: 'Download the extension code',
    ext_manual_step1_body:
      'Download it from your GitHub repository or as a hosted zip file.',
    ext_manual_step2_title: 'Open Chrome Extensions',
    ext_manual_step2_body:
      'Go to chrome://extensions and turn on Developer mode.',
    ext_manual_step3_title: 'Load unpacked',
    ext_manual_step3_body:
      'Click Load unpacked and choose the extension/ folder.',
    ext_copy_title: 'Copy-paste for the Chrome address bar',
    ext_copy_sub: 'This opens the extensions page directly.',
    ext_copy_btn: 'Copy: chrome://extensions',
    ext_codebox:
      '1) Open chrome://extensions\n2) Enable "Developer mode" in the top right\n3) Click "Load unpacked"\n4) Select the folder: extension/',
    ext_protip_label: 'Pro tip:',
    ext_protip_body:
      'When you have a zip, host it under /downloads/peerrate-extension.zip and link to it from this page.',
    ext_test_title: 'Test the extension',
    ext_test_sub: 'Quick check',
    ext_test_li1: 'Install the extension from Web Store or manually.',
    ext_test_li2: 'Open a completed deal on Tradera.',
    ext_test_li3: 'Click “Rate with PeerRate”.',
    ext_test_li4:
      'You land on /rate.html?pr=... and see a verified deal with a locked form.',
    ext_test_li5:
      'Submit and verify that the success toast appears.',
    ext_test_cta_rate: 'Open rate.html',
    ext_test_cta_top: 'Back to top',
    ext_footer_tagline: 'Verified ratings — built for trust',
    ext_toast_default: 'Copied!',
    ext_toast_copy_success: 'Copied: chrome://extensions',
    ext_toast_copy_fail:
      'Could not copy. Your browser may block clipboard access.',

    // Rate page
    rate_kicker: 'Verified rating flow',
    rate_hub_h1: 'Leave a rating — via a verified deal',
    rate_hub_lead:
      'To reduce spam and manipulation, you can only leave a rating when we can connect it to a completed deal. Choose how you want to verify it.',
    rate_side_verified_title: 'Why a verified deal?',
    rate_side_verified_body:
      'PeerRate is built on ratings tied to real completed transactions, not open forms without proof.',
    rate_side_flow_title: 'How the flow works',
    rate_side_flow_body:
      'Choose a platform, open the completed deal, send verified data from the extension, and then leave your rating here.',
    rate_side_future_title: 'What comes next',
    rate_side_future_body:
      'The next step is automatic verification via email, receipts and more platforms.',

    rate_method_title: 'Step 1: Choose verification method',
    rate_method_platform_title: 'Platform (fastest)',
    rate_method_platform_lead:
      'Open the platform, find the completed deal, click the extension, and come back here.',
    rate_method_choose_platform: 'Choose',
    rate_method_email_title: 'Email / receipts (coming automatically)',
    rate_method_email_lead:
      'Connect your inbox and we can identify completed deals automatically and suggest ready-made rating drafts.',
    rate_method_choose_email: 'Show',

    rate_platform_title: 'Step 2: Start from a platform',
    rate_platform_lead:
      'Choose a platform and deal type. We open the platform, then you find the completed deal and click the extension.',
    rate_platform_label: 'Platform',
    rate_platform_pick: 'Choose platform…',
    rate_platform_flow_label: 'Deal type',
    rate_platform_flow_pick: 'Choose…',
    rate_platform_flow_buy: 'Buy',
    rate_platform_flow_sell: 'Sell',
    rate_platform_flow_booking: 'Booking / rental',
    rate_platform_flow_other: 'Other',
    rate_platform_go: 'Open platform',
    rate_platform_how_label: 'How to do it:',
    rate_platform_step1: 'Open the platform.',
    rate_platform_step2: 'Find the completed deal, preferably an order, receipt or invoice view.',
    rate_platform_step3: 'Click the PeerRate extension to send verified data.',
    rate_platform_note:
      'Tip: After sending from the extension, you will come back here with “Verified source” filled in.',

    rate_email_title: 'Step 2: Verify via email / receipts',
    rate_email_lead:
      'Coming soon: Connect Gmail or Outlook so we can automatically identify completed deals and generate rating suggestions.',
    rate_email_connect: 'Connect inbox',
    rate_email_note: 'For now, use the platform flow for the fastest experience.',

    rate_verified_title: 'Verified deals',
    rate_verified_lead:
      'Your identified completed deals will appear here. From there you can leave a rating.',
    rate_verified_empty: 'No verified deals yet.',
    rate_verified_card_title: 'Verified deal',

    rate_context_title: 'Verified source',
    rate_context_source_label: 'Source:',
    rate_context_view_source: 'View the page that triggered the rating →',
    rate_context_tip_title: 'Tip',
    rate_context_tip_body:
      'Next step: once we have hard data like counterparty, amount and date, we show a locked rating form.',

    rate_login_title: 'Log in',
    rate_login_lead:
      'Log in with the email and password you used when signing up.',
    rate_login_email_label: 'Email',
    rate_login_email_ph: 'erik@example.com',
    rate_login_password_label: 'Password',
    rate_login_password_ph: 'Your password',
    rate_login_forgot: 'Forgot your password?',
    rate_login_btn: 'Log in',
    rate_signup: 'Sign up',

    rate_step3_title: 'Step 3: Leave a rating',
    rate_step3_lead:
      'The form is locked to the verified deal. You can only choose a score and write a comment.',
    rate_score_label: 'Rating',
    rate_pick_score: 'Choose…',
    rate_score_1: '1 – Very bad',
    rate_score_2: '2 – Bad',
    rate_score_3: '3 – Okay',
    rate_score_4: '4 – Good',
    rate_score_5: '5 – Very good',
    rate_comment_label: 'Comment (optional)',
    rate_comment_ph: 'What worked well or poorly?',
    rate_submit_rating: 'Submit rating',
    rate_submit_loading: 'Submitting…',

    rate_label_source: 'Source',
    rate_label_order_proof: 'Order / Proof',
    rate_label_counterparty_email: 'Counterparty (email)',
    rate_label_name: 'Name',
    rate_label_phone: 'Phone',
    rate_label_address: 'Address',
    rate_label_amount: 'Amount',
    rate_label_date: 'Date',
    rate_view_source: 'View source →',

    rate_error_login_required: 'You need to log in to submit a rating.',
    rate_error_missing_counterparty: 'Counterparty is missing from the verified deal.',
    rate_error_pick_score: 'Please choose a rating.',
    rate_error_duplicate: 'A rating has already been submitted for this deal.',
    rate_error_save: 'Could not save the rating.',
    rate_error_technical: 'Technical error. Please try again shortly.',

    rate_success_title: 'Thanks for your rating! ✅',
    rate_success_body: 'Your rating has been registered.',
    rate_success_next: 'You can now close the page or go to your profile.',
    rate_success_saved: 'Your rating has been saved.',
    rate_success_saved_toast: 'Thanks! Your rating has been saved.',
    rate_go_profile: 'Go to profile',
    rate_go_home: 'Go to homepage',

    profile_badge_label: 'Signed in as',
    profile_h1: 'My profile',
    profile_lead: 'Here you can see your details and your combined reputation.',
    profile_login_title: 'Log in',
    profile_login_lead: 'Log in with the email and password you used when signing up.',
    profile_login_email: 'Email',
    profile_login_password: 'Password',
    profile_login_email_ph: 'erik@example.com',
    profile_login_password_ph: 'Your password',
    profile_login_btn: 'Log in',

    profile_my_rating_title: 'My rating',
    profile_my_rating_lead: 'A summary of ratings linked to your email address.',
    profile_rating_sources_title: 'Where do your ratings come from?',
    profile_no_ratings: 'No ratings',
    profile_no_ratings_yet: 'No ratings yet.',
    profile_no_ratings_short: 'No ratings yet.',
    profile_pr_rating_title: 'Your PeerRate rating',
    profile_avg_label: 'Average score:',
    profile_based_on: 'based on',
    profile_reviews: 'reviews',
    profile_current_rating: 'Your current rating is {value} / 5.',
    profile_total_ratings: '{count} ratings',
    profile_my_details_title: 'My details',
    profile_my_details_lead: 'Details linked to your profile.',
    profile_avatar_upload: 'Upload profile picture',
    profile_avatar_note: 'The image is stored locally in your browser and used for “Signed in as”.',
    profile_avatar_title: 'Click to change image',
    profile_logout_btn: 'Log out',
    profile_default_name: 'Profile',

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

    profile_address_status_verified: 'Verified (address found in address registry)',
    profile_address_status_from_profile: 'From your profile (not externally verified)',
    profile_address_status_no_external_data: 'No external data',
    profile_address_status_no_address_input: 'No address entered',
    profile_address_status_no_address_in_response: 'No address in service response',
    profile_address_status_no_address: 'No address',
    profile_address_status_lookup_failed: 'Technical error during address validation',
    profile_address_status_unknown: 'Unknown status ({status})',

    profile_rating_source_other: 'Other/unknown',
    profile_rating_source_blaget_fallback: 'Other/unknown',
    profile_rating_by: 'by {name}',
    profile_rating_via: 'rated via {source}',
    profile_rater_unknown: 'Unknown',

    profile_login_error_missing_fields: 'Please enter both email and password.',
    profile_login_error_failed: 'Login failed. Please check your details.',
    profile_login_success: 'You are now logged in.',
    profile_login_error_technical: 'Technical error during login. Please try again shortly.',
    profile_logout_success: 'You are now logged out.',
    profile_logout_error: 'Could not log out. Please try again.',

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

    customer_error_server_status: 'Server error (status {status})',
    customer_error_fill_email: 'Please enter an email address.',
    customer_error_email_mismatch: 'Email addresses do not match.',
    customer_error_password_length: 'Password must be at least 8 characters.',
    customer_error_password_mismatch: 'Passwords do not match.',
    customer_error_terms_required: 'You must accept the terms to create an account.',
    customer_status_creating_account: 'Creating account…',
    customer_step1_success: 'Thanks! Account created.',
    customer_step1_success_continue: 'Account created! Continue with step 2 below.',
    customer_step1_success_no_step2: 'Account created! (Step 2 form was not found on the page — check that it exists in HTML.)',
    customer_error_timeout: 'The server is not responding (timeout). Please try again.',
    customer_error_email_exists: 'An account with this email already exists.',
    customer_error_contact_server: 'Could not contact the server. Please try again.',
    customer_error_missing_step1_email: 'Missing email from step 1. Please complete step 1 first.',
    customer_error_first_name: 'Please enter first name (at least 2 characters).',
    customer_error_last_name: 'Please enter last name (at least 2 characters).',
    customer_error_personal_number: 'Please enter personal number.',
    customer_error_address: 'Please enter address.',
    customer_error_postal_code: 'Please enter postal code.',
    customer_error_city: 'Please enter city.',
    customer_status_saving_profile: 'Saving profile…',
    customer_step2_success: 'Profile saved!',
    customer_error_conflict: 'Conflict: email/personal number already exists.',
    customer_error_save_profile: 'Could not save the profile. Please try again.',

    footer_privacy: 'Privacy',
    footer_profile: 'Profile',
    footer_ask: 'See the 5P model',
  },
};

function getBrowserPreferredLanguage() {
  try {
    const browserLang =
      (navigator.language || navigator.userLanguage || '').toLowerCase();

    if (browserLang.startsWith('sv')) return 'sv';
    return DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function safeGetStoredLanguage() {
  try {
    const stored = localStorage.getItem(LS_LANG);
    if (stored === 'sv' || stored === 'en') return stored;
    return getBrowserPreferredLanguage();
  } catch {
    return getBrowserPreferredLanguage();
  }
}

export function getCurrentLanguage() {
  const lang = safeGetStoredLanguage();
  return lang === 'sv' ? 'sv' : 'en';
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] != null ? String(params[key]) : `{${key}}`;
  });
}

export function t(key, fallback = '', params = {}) {
  const lang = getCurrentLanguage();
  const langDict = dict[lang] || dict.en;
  const baseDict = dict.en || {};

  const value =
    langDict[key] != null
      ? langDict[key]
      : baseDict[key] != null
        ? baseDict[key]
        : fallback;

  if (value == null) return fallback || key;
  return interpolate(value, params);
}

function applyTextTranslations(root) {
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (!key) return;
    node.textContent = t(key, node.textContent || '');
  });
}

function applyPlaceholderTranslations(root) {
  root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder');
    if (!key) return;
    node.setAttribute('placeholder', t(key, node.getAttribute('placeholder') || ''));
  });
}

function applyMultilineTranslations(root) {
  root.querySelectorAll('[data-i18n-multiline]').forEach((node) => {
    const key = node.getAttribute('data-i18n-multiline');
    if (!key) return;
    node.innerHTML = t(key, node.innerHTML || '').replace(/\n/g, '<br/>');
  });
}

function applyTitleTranslations(root) {
  root.querySelectorAll('[data-i18n-title]').forEach((node) => {
    const key = node.getAttribute('data-i18n-title');
    if (!key) return;
    node.setAttribute('title', t(key, node.getAttribute('title') || ''));
  });
}

function applyAriaLabelTranslations(root) {
  root.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
    const key = node.getAttribute('data-i18n-aria-label');
    if (!key) return;
    node.setAttribute('aria-label', t(key, node.getAttribute('aria-label') || ''));
  });
}

function emitLanguageChanged(lang) {
  try {
    window.dispatchEvent(
      new CustomEvent('peerrate:language-changed', {
        detail: { lang },
      })
    );
  } catch {}
}

export function applyLang(root = document, options = {}) {
  const lang = getCurrentLanguage();
  const shouldEmit = options.emit === true;

  document.documentElement.lang = lang === 'sv' ? 'sv' : 'en';

  const langLabel = document.getElementById('langLabel');
  if (langLabel) {
    langLabel.textContent = lang === 'en' ? 'EN' : 'SV';
  }

  applyTextTranslations(root);
  applyPlaceholderTranslations(root);
  applyMultilineTranslations(root);
  applyTitleTranslations(root);
  applyAriaLabelTranslations(root);

  try {
    window.__peerRateLang = lang;
  } catch {}

  if (shouldEmit) {
    emitLanguageChanged(lang);
  }
}

export function setLanguage(lang) {
  const safeLang = lang === 'sv' ? 'sv' : 'en';

  try {
    localStorage.setItem(LS_LANG, safeLang);
  } catch {}

  applyLang(document, { emit: true });
}

let applyTimer = null;
function applyLangDebounced(root = document) {
  if (applyTimer) clearTimeout(applyTimer);
  applyTimer = setTimeout(() => applyLang(root), 60);
}

export function initLandingLanguage() {
  const langBtn = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');

  if (!langBtn || !langMenu) {
    applyLang(document);
    return;
  }

  let open = false;

  const setMenuOpen = (value) => {
    open = Boolean(value);
    langMenu.style.display = open ? 'block' : 'none';
    langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  if (!langBtn.dataset.langBound) {
    langBtn.dataset.langBound = 'true';
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMenuOpen(!open);
    });
  }

  if (!langMenu.dataset.langBound) {
    langMenu.dataset.langBound = 'true';
    langMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-lang]');
      if (!btn) return;
      const lang = btn.getAttribute('data-lang') || DEFAULT_LANG;
      setLanguage(lang);
      setMenuOpen(false);
    });
  }

  if (!window.__peerRateLangWindowClickBound) {
    window.__peerRateLangWindowClickBound = true;
    window.addEventListener('click', (e) => {
      const currentBtn = document.getElementById('langBtn');
      const currentMenu = document.getElementById('langMenu');
      if (!currentBtn || !currentMenu) return;
      if (e.target.closest('#langBtn') || e.target.closest('#langMenu')) return;
      currentMenu.style.display = 'none';
      currentBtn.setAttribute('aria-expanded', 'false');
    });
  }

  if (!window.__peerRateLangEscapeBound) {
    window.__peerRateLangEscapeBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const currentBtn = document.getElementById('langBtn');
      const currentMenu = document.getElementById('langMenu');
      if (currentMenu) currentMenu.style.display = 'none';
      if (currentBtn) currentBtn.setAttribute('aria-expanded', 'false');
    });
  }

  if (!window.__peerRateLangObserverBound) {
    window.__peerRateLangObserverBound = true;

    const obs = new MutationObserver(() => {
      applyLangDebounced(document);
    });

    try {
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
  }

  applyLang(document);
}