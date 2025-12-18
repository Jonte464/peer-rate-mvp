// frontend/modules/main.js
// Huvudfil som importerar och startar frontend-moduler + landing-interaktioner

import auth from './auth.js';
import api from './api.js';
import { el, showNotice, clearNotice } from './utils.js';
import customerForm from './customer.js';
import { updateUserBadge, updateAvatars, initProfilePage, initRatingLogin } from './profile.js';
import { adminLoginForm, adminLogoutBtn } from './admin.js';

/**
 * Döljer eller visar login-hint på sidan Lämna betyg.
 */
function updateRatingLoginHint(user) {
  const hint = document.getElementById('rating-login-hint');
  if (!hint) return;
  if (user) hint.classList.add('hidden');
  else hint.classList.remove('hidden');
}

/* =========================
   LANDING: mikrointeraktioner
   + språk (SV/EN)
   + hamburgermeny
   + simulator (2 sliders)
   + reputation-card flip
   + KPI placeholders
   + top-user initialer
   ========================= */

function initLandingMenu() {
  const menuBtn = document.getElementById('menuBtn');
  const menuPanel = document.getElementById('menuPanel');
  if (!menuBtn || !menuPanel) return;

  const setOpen = (open) => {
    menuPanel.style.display = open ? 'block' : 'none';
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  let open = false;
  menuBtn.addEventListener('click', () => {
    open = !open;
    setOpen(open);
  });

  // Stäng menyn när man klickar på en länk i panelen
  menuPanel.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    open = false;
    setOpen(false);
  });

  // Stäng vid ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

function initLandingLanguage() {
  const langBtn = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');
  const langLabel = document.getElementById('langLabel');
  if (!langBtn || !langMenu || !langLabel) return;

  // Minimal i18n: data-i18n nycklar
  const dict = {
    sv: {
      // top / menu
      top_sub: 'Förtroende du kan bevisa',
      menu_how: 'Hur det funkar',
      menu_sim: 'Se värdet direkt',
      menu_globe: 'Global trust',
      menu_rate: 'Lämna betyg',
      menu_signup: 'Registrera dig',
      menu_profile: 'Min profil',
      menu_ask: 'Fråga om trust',

      // hero
      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Förtroende du kan bevisa.',
      hero_p: 'PeerRate gör att du kan bära med dig verifierad trovärdighet mellan marknadsplatser. Inte känsla. Inte påståenden. Riktiga transaktioner — portabelt och svårt att fejka.',
      hero_cta_primary: 'Kom igång',
      hero_cta_secondary: 'Fråga om trust',
      hero_card_title: 'Ett reputation card du kan dela',
      hero_card_p: 'Ett kompakt kvitto på hur du agerar i P2P — över plattformar.',
      hero_metric_score: 'Förtroende (1–5)',
      hero_metric_tx: 'Verifierade transaktioner',

      // how
      how_title: 'En snabbfil för människor online.',
      how_lead: 'PeerRate standardiserar betyg och kopplar dem till riktiga affärer — så att förtroende blir mätbart, portabelt och rättvist.',
      f1_title: 'Verifierat',
      f1_p: 'Koppla reputation till riktiga transaktioner. Mindre bedrägeri, färre missar.',
      f2_title: 'Portabelt',
      f2_p: 'Ta med din trust score mellan marknadsplatser istället för att börja från noll.',
      f3_title: 'Förklarbart',
      f3_p: 'Tydligt vad som påverkar din score — inte en svart låda.',

      // sim / card
      sim_title: 'Se värdet direkt.',
      rep_name_fallback: 'Din profil',
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

      // globe + kpi
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

      // rate
      rate_login_title: 'Logga in',
      rate_login_lead: 'Logga in med den e-post och det lösenord du registrerade dig med innan du lämnar betyg.',
      rate_signup: 'Registrera dig',
      rate_title: 'Lämna ett betyg',
      footer_profile: 'Profil',
      footer_ask: 'Fråga om trust',
    },

    en: {
      // top / menu
      top_sub: 'Trust you can prove',
      menu_how: 'How it works',
      menu_sim: 'See the value',
      menu_globe: 'Global trust',
      menu_rate: 'Leave a rating',
      menu_signup: 'Sign up',
      menu_profile: 'My profile',
      menu_ask: 'Ask about trust',

      // hero
      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Trust you can prove.',
      hero_p: 'PeerRate helps you carry verified reputation between marketplaces. Not vibes. Not claims. Real transactions — portable and hard to fake.',
      hero_cta_primary: 'Get started',
      hero_cta_secondary: 'Ask about trust',
      hero_card_title: 'A reputation card you can share',
      hero_card_p: 'A compact proof of how you behave in P2P — across platforms.',
      hero_metric_score: 'Trust (1–5)',
      hero_metric_tx: 'Verified transactions',

      // how
      how_title: 'A priority lane for trustworthy people online.',
      how_lead: 'PeerRate standardizes ratings and links them to real transactions — making trust measurable, portable and fair.',
      f1_title: 'Verified',
      f1_p: 'Connect reputation to real transactions. Less fraud, fewer bad surprises.',
      f2_title: 'Portable',
      f2_p: 'Bring your trust score across marketplaces instead of starting from zero.',
      f3_title: 'Explainable',
      f3_p: 'A clear breakdown of what affects your score — not a black box.',

      // sim / card
      sim_title: 'See the value instantly.',
      rep_name_fallback: 'Your profile',
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

      // globe + kpi
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

      // rate
      rate_login_title: 'Log in',
      rate_login_lead: 'Log in with the email and password you used when signing up before leaving a rating.',
      rate_signup: 'Sign up',
      rate_title: 'Leave a rating',
      footer_profile: 'Profile',
      footer_ask: 'Ask about trust',
    }
  };

  const LS_LANG = 'peerRateLang_v1';

  function applyLang(lang) {
    const d = dict[lang] || dict.sv;

    document.documentElement.lang = lang === 'en' ? 'en' : 'sv';
    langLabel.textContent = (lang === 'en') ? 'EN' : 'SV';

    const nodes = document.querySelectorAll('[data-i18n]');
    nodes.forEach(n => {
      const key = n.getAttribute('data-i18n');
      if (!key) return;
      if (d[key] != null) n.textContent = d[key];
    });

    localStorage.setItem(LS_LANG, lang);
  }

  // Toggle dropdown
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

  // Default: svenska
  const saved = localStorage.getItem(LS_LANG) || 'sv';
  applyLang(saved);
}

function initReputationFlip() {
  const flip = document.getElementById('repFlip');
  const backBtn = document.getElementById('flipBackBtn');
  if (!flip) return;

  const toggle = () => flip.classList.toggle('is-flipped');

  flip.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (e.target.closest('#flipBackBtn')) return;
    toggle();
  });

  flip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });

  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      flip.classList.remove('is-flipped');
    });
  }

  flip.addEventListener('mouseenter', () => {
    if (window.matchMedia('(hover:hover)').matches) flip.classList.add('is-flipped');
  });
  flip.addEventListener('mouseleave', () => {
    if (window.matchMedia('(hover:hover)').matches) flip.classList.remove('is-flipped');
  });
}

/* =========
   Top-user initialer (fixar "D"-buggen)
   ========= */

function initialsFromString(str) {
  const s = String(str || '').trim();
  if (!s) return null;

  // e-post
  if (s.includes('@')) {
    const left = s.split('@')[0] || '';
    const parts = left.replace(/[._-]+/g, ' ').split(' ').filter(Boolean);
    const a = (parts[0]?.[0] || left[0] || '').toUpperCase();
    const b = (parts[1]?.[0] || left[1] || '').toUpperCase();
    const out = (a + b).replace(/[^A-ZÅÄÖ]/g, '');
    return out || null;
  }

  // namn
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || '').toUpperCase();
  const b = (parts[1]?.[0] || '').toUpperCase();
  const out = (a + b).replace(/[^A-ZÅÄÖ]/g, '');
  return out || null;
}

function extractUserLabel(user) {
  if (!user) return null;
  return (
    user.fullName ||
    user.name ||
    user.displayName ||
    user.email ||
    user.user?.email ||
    user.user?.name ||
    null
  );
}

function getFallbackUserLabelFromStorage() {
  const candidates = [
    'peerRateUser',
    'peerRateAuthUser',
    'peerRateCurrentUser',
    'peerRateUserEmail',
    'pr_user',
    'user',
    'authUser'
  ];

  for (const k of candidates) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;

    // raw email
    if (raw.includes('@') && raw.length < 200) return raw;

    try {
      const obj = JSON.parse(raw);
      const found =
        obj?.fullName ||
        obj?.name ||
        obj?.displayName ||
        obj?.email ||
        obj?.user?.email ||
        obj?.user?.name ||
        null;
      if (found) return found;
    } catch (_) {}
  }
  return null;
}

function updateTopUserPill(user) {
  const pill = document.getElementById('topUserPill');
  const initialsEl = document.getElementById('topUserInitials');
  if (!pill || !initialsEl) return;

  // 1) Primärt: auth.getUser()
  const label = extractUserLabel(user);

  // 2) Fallback: localStorage
  const label2 = label || getFallbackUserLabelFromStorage();

  const ini = initialsFromString(label2);
  if (ini) {
    initialsEl.textContent = ini;
    pill.style.display = 'inline-flex';
    pill.setAttribute('aria-label', 'Inloggad: ' + ini);
    pill.title = 'Inloggad: ' + ini;
  } else {
    pill.style.display = 'none';
  }
}

/* =========
   2-sliders simulator (volym + snitt => 1..5P)
   ========= */

function initTwoSliderSimulator() {
  const countSlider = document.getElementById('countSlider');
  const avgSlider = document.getElementById('avgSlider');

  // Om den nya simulatorn inte finns på sidan → gör inget (äventyrar inget)
  if (!countSlider || !avgSlider) return;

  const simCount = document.getElementById('simCount');
  const simAvg = document.getElementById('simAvg');
  const simScore = document.getElementById('simScore');
  const simPCount = document.getElementById('simPCount');

  const heroScore = document.getElementById('heroScore');
  const repScore = document.getElementById('repScore');

  const pEls = Array.from(document.querySelectorAll('.pbar .p'));

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function volumeFactor(n) {
    // 0..200 -> 0..1 (avtagande marginal)
    return 1 - Math.exp(-n / 55);
  }

  function totalScore(count, avg) {
    const q = clamp((avg - 1) / 4, 0, 1);
    const v = clamp(volumeFactor(count), 0, 1);
    const base = 1 + 4 * (q * (0.55 + 0.45 * v));
    return clamp(base, 1, 5);
  }

  function pFilled(score) {
    if (score >= 4.6) return 5;
    if (score >= 4.0) return 4;
    if (score >= 3.3) return 3;
    if (score >= 2.3) return 2;
    return 1;
  }

  function setPBar(filled) {
    pEls.forEach((el, i) => el.classList.toggle('is-on', i < filled));
  }

  function update() {
    const count = Number(countSlider.value || 0);
    const avg = Number(avgSlider.value || 1);

    if (simCount) simCount.textContent = String(count);
    if (simAvg) simAvg.textContent = avg.toFixed(1);

    const score = totalScore(count, avg);
    const filled = pFilled(score);

    if (simScore) simScore.textContent = score.toFixed(1);
    if (simPCount) simPCount.textContent = String(filled);

    setPBar(filled);

    // uppdatera de två score-ställena (om de finns)
    if (heroScore) heroScore.textContent = score.toFixed(1);
    if (repScore) repScore.textContent = score.toFixed(1);
  }

  countSlider.addEventListener('input', update);
  avgSlider.addEventListener('input', update);

  update();
}

function initReportFlagToggle() {
  const flag = document.getElementById('reportFlag');
  const box = document.getElementById('reportDetails');
  if (!flag || !box) return;
  const sync = () => { box.style.display = flag.checked ? 'block' : 'none'; };
  flag.addEventListener('change', sync);
  sync();
}

function initKpis() {
  const kUsers = document.getElementById('kUsers');
  const kTx = document.getElementById('kTx');
  const kRatings = document.getElementById('kRatings');

  if (kUsers) kUsers.textContent = '—';
  if (kTx) kTx.textContent = '—';
  if (kRatings) kRatings.textContent = '—';
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  const user = auth.getUser();

  updateUserBadge(user);
  updateAvatars(user);
  updateTopUserPill(user);

  if (customerForm) console.log('Customer form loaded');
  if (adminLoginForm && adminLogoutBtn) console.log('Admin functionality loaded');

  const path = window.location.pathname || '';

  if (path.includes('/min-profil') || path.includes('profile.html') || path.includes('/profile')) {
    initProfilePage();
  }

  const isRatingPage =
    path.includes('/lamna-betyg') ||
    path.includes('index.html') ||
    document.getElementById('rating-card');

  if (isRatingPage) {
    initRatingLogin();
    updateRatingLoginHint(user);
  }

  initLandingMenu();
  initLandingLanguage();
  initReputationFlip();

  // NYTT: din 2-sliders-simulator, säkert (noop om saknas)
  initTwoSliderSimulator();

  // report toggle (noop om saknas)
  initReportFlagToggle();

  initKpis();

  // Håll top-user pill uppdaterad om login sker i annan flik / storage change
  window.addEventListener('storage', () => {
    const u2 = auth.getUser();
    updateTopUserPill(u2);
  });

  // “safe refresh” ibland ifall auth skriver async till localStorage
  setInterval(() => updateTopUserPill(auth.getUser()), 1500);
});
