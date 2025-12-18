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
   + simulator
   + reputation-card flip
   + KPI placeholders
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
      top_sub: 'Förtroende du kan bevisa',
      menu_how: 'Hur det funkar',
      menu_sim: 'What if?-simulator',
      menu_globe: 'Global trust',
      menu_rate: 'Lämna betyg',
      menu_signup: 'Registrera dig',
      menu_profile: 'Min profil',
      menu_ask: 'Fråga om trust',

      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Förtroende du kan bevisa.',
      hero_p: 'PeerRate gör att du kan bära med dig verifierad trovärdighet mellan marknadsplatser. Inte känsla. Inte påståenden. Riktiga transaktioner — portabelt och svårt att fejka.',
      hero_cta_primary: 'Kom igång',
      hero_cta_secondary: 'Fråga om trust',
      hero_card_title: 'Ett reputation card du kan dela',
      hero_card_p: 'Ett kompakt kvitto på hur du agerar i P2P — över plattformar.',
      hero_metric_score: 'Trust score',
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
      sim_lead: 'Två visuella “investerarvänliga” block: reputation card + What if? simulator.',
      rep_score: 'Peer-to-peer trust score',
      rep_tx: 'Verifierade transaktioner',
      rep_plat: 'Plattformar kopplade',
      rep_hint: 'Hover / klick',
      rep_hint2: 'Explain my score',
      rep_btn: 'Öppna min profil',
      rep_btn2: 'Förklara min score',

      back_title: 'Varför den här scoren?',
      back_p: 'Scoren är en viktad sammanfattning av verifierade transaktioner, betygskvalitet, färskhet och risksignaler. Målet: portabel trust som är svår att fejka.',
      back_b1: 'Verifierad historik',
      back_t1: 'Fler verifierade affärer ökar tryggheten.',
      back_b2: 'Stabilitet',
      back_t2: 'Konsekvent bra beteende över tid belönas.',
      back_b3: 'Risksignaler',
      back_t3: 'Dispyter och misstänkta mönster sänker score.',
      back_btn: 'Tillbaka',
      back_btn2: 'Fråga om trust',

      sim_h3: 'What if den här användaren hade fler verifierade transaktioner?',
      sim_p: 'Dra slidern för att simulera. Score, färgsignal och micro-graf uppdateras direkt.',
      sim_score: 'Trust',
      sim_label: 'Tillagda verifierade transaktioner:',
      sim_graph: 'Trust trajectory',

      globe_title: 'Ett globalt lager av trust.',
      globe_lead: 'En delbar och portabel reputationssignal som på sikt kan komplettera (eller slå) traditionella kreditsignaler.',
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

      rate_title: 'Lämna betyg',
      rate_lead: 'Logga in och lämna ett betyg. (Du kan också registrera dig om du inte har ett konto.)',
    },
    en: {
      top_sub: 'Trust you can prove',
      menu_how: 'How it works',
      menu_sim: 'What if? simulator',
      menu_globe: 'Global trust',
      menu_rate: 'Leave a rating',
      menu_signup: 'Sign up',
      menu_profile: 'My profile',
      menu_ask: 'Ask about trust',

      hero_kicker: 'Peer-to-peer reputation',
      hero_h1: 'Trust you can prove.',
      hero_p: 'PeerRate helps you carry verified reputation between marketplaces. Not vibes. Not claims. Real transactions — portable and hard to fake.',
      hero_cta_primary: 'Get started',
      hero_cta_secondary: 'Ask about trust',
      hero_card_title: 'A reputation card you can share',
      hero_card_p: 'A compact proof of how you behave in P2P — across platforms.',
      hero_metric_score: 'Trust score',
      hero_metric_tx: 'Verified transactions',

      how_title: 'A priority lane for trustworthy people online.',
      how_lead: 'PeerRate standardizes ratings and links them to real transactions — making trust measurable, portable and fair.',
      f1_title: 'Verified',
      f1_p: 'Connect reputation to real transactions. Less fraud, fewer bad surprises.',
      f2_title: 'Portable',
      f2_p: 'Bring your trust score across marketplaces instead of starting from zero.',
      f3_title: 'Explainable',
      f3_p: 'A clear breakdown of what affects your score — not a black box.',

      sim_title: 'See the value instantly.',
      sim_lead: 'Two visual “investor-friendly” blocks: a shareable reputation card + a What if? simulator.',
      rep_score: 'Peer-to-peer trust score',
      rep_tx: 'Verified transactions',
      rep_plat: 'Platforms connected',
      rep_hint: 'Hover / click',
      rep_hint2: 'Explain my score',
      rep_btn: 'Open my profile',
      rep_btn2: 'Explain my score',

      back_title: 'Why this score?',
      back_p: 'Score is a weighted summary of verified transactions, rating quality, recency and dispute signals. The goal: portable trust that is hard to fake.',
      back_b1: 'Verified history',
      back_t1: 'More verified transactions increases confidence.',
      back_b2: 'Consistency',
      back_t2: 'Stable positive behavior over time is rewarded.',
      back_b3: 'Risk signals',
      back_t3: 'Disputes and suspicious patterns reduce score.',
      back_btn: 'Back',
      back_btn2: 'Ask about trust',

      sim_h3: 'What if this user had more verified transactions?',
      sim_p: 'Slide to simulate impact. The score, color signal and micro-graph updates instantly.',
      sim_score: 'Trust',
      sim_label: 'Added verified transactions:',
      sim_graph: 'Trust trajectory',

      globe_title: 'A global layer of trust.',
      globe_lead: 'A shared, portable reputation signal that can complement (or beat) traditional credit signals over time.',
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

      rate_title: 'Leave a rating',
      rate_lead: 'Log in and leave a rating. (You can also sign up if you don’t have an account.)',
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
      if (d[key]) n.textContent = d[key];
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
    // Om klick på länk, låt den funka
    if (e.target.closest('a')) return;
    // Om klick på back-knappen, hantera separat
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

  // Auto “hover flip” på desktop (mjuk)
  flip.addEventListener('mouseenter', () => {
    if (window.matchMedia('(hover:hover)').matches) flip.classList.add('is-flipped');
  });
  flip.addEventListener('mouseleave', () => {
    if (window.matchMedia('(hover:hover)').matches) flip.classList.remove('is-flipped');
  });
}

function initWhatIfSimulator() {
  const slider = document.getElementById('txSlider');
  const addedEl = document.getElementById('simAdded');
  const scoreEl = document.getElementById('simScore');
  const heroScore = document.getElementById('heroScore');
  const repScore = document.getElementById('repScore');

  const dot = document.getElementById('scoreDot');
  const colorLabel = document.getElementById('simColorLabel');

  const sparkPath = document.getElementById('sparkPath');
  const sparkDot = document.getElementById('sparkDot');

  if (!slider || !addedEl || !scoreEl) return;

  // Basvärden (för demo)
  const baseScore = 88;
  const baseTx = 117;

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function colorFor(score){
    // Enkel färgsignal
    if (score >= 92) return { dot:'#22c55e', label:'Low risk' };
    if (score >= 86) return { dot:'#eab308', label:'Medium risk' };
    return { dot:'#ef4444', label:'Higher risk' };
  }

  function makeSpark(score){
    // Skapar en “kurva” som blir bättre ju högre score
    // (detta är visuellt – inte matematisk sanning)
    const s = clamp(score, 60, 99);
    const yEnd = 80 - (s - 60) * 1.2; // 80 -> ~33
    const y1 = 70 - (s - 60) * 0.6;
    const y2 = 64 - (s - 60) * 0.7;
    const y3 = 58 - (s - 60) * 0.8;
    const y4 = 46 - (s - 60) * 0.5;
    const y5 = 40 - (s - 60) * 0.4;

    const d = `M10 70 L50 ${y1.toFixed(0)} L90 ${y2.toFixed(0)} L130 ${y3.toFixed(0)} L170 ${y4.toFixed(0)} L210 ${yEnd.toFixed(0)}`;
    return { d, x:210, y:yEnd };
  }

  function update(val){
    const added = Number(val || 0);
    addedEl.textContent = String(added);

    // Enkel sim: varje +10 tx ger +1.2 score, med avtagande effekt
    const txTotal = baseTx + added;
    const gain = Math.log10(1 + txTotal / 40) * 10; // mjuk kurva
    const score = clamp(Math.round(baseScore + gain), 60, 98);

    scoreEl.textContent = String(score);
    if (heroScore) heroScore.textContent = String(score);
    if (repScore) repScore.textContent = String(score);

    const c = colorFor(score);
    if (dot) {
      dot.style.background = c.dot;
      dot.style.boxShadow = `0 0 0 6px ${c.dot}22`;
    }
    if (sparkDot) sparkDot.setAttribute('fill', c.dot);
    if (colorLabel) colorLabel.textContent = c.label;

    const sp = makeSpark(score);
    if (sparkPath) sparkPath.setAttribute('d', sp.d);
    if (sparkDot) {
      sparkDot.setAttribute('cx', String(sp.x));
      sparkDot.setAttribute('cy', String(Math.round(sp.y)));
    }
  }

  slider.addEventListener('input', (e) => update(e.target.value));
  update(slider.value);
}

function initKpis() {
  // För nu: statiska placeholders (vi kan koppla detta mot backend senare)
  const kUsers = document.getElementById('kUsers');
  const kTx = document.getElementById('kTx');
  const kRatings = document.getElementById('kRatings');

  if (kUsers) kUsers.textContent = '—';      // sen: hämta från API
  if (kTx) kTx.textContent = '—';
  if (kRatings) kRatings.textContent = '—';
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  // Hämta inloggad användare
  const user = auth.getUser();

  // Uppdatera topp-badgen + avatar (för sidor som har det)
  updateUserBadge(user);
  updateAvatars(user);

  if (customerForm) console.log('Customer form loaded');
  if (adminLoginForm && adminLogoutBtn) console.log('Admin functionality loaded');

  // Vilken sida är vi på?
  const path = window.location.pathname || '';

  // Initiera profilsidan
  if (path.includes('/min-profil') || path.includes('profile.html') || path.includes('/profile')) {
    initProfilePage();
  }

  // Initiera Lämna betyg-sidan (index.html har rating-card)
  const isRatingPage =
    path.includes('/lamna-betyg') ||
    path.includes('index.html') ||
    document.getElementById('rating-card');

  if (isRatingPage) {
    initRatingLogin();
    updateRatingLoginHint(user);
  }

  // Landing-interaktioner (om elementen finns)
  initLandingMenu();
  initLandingLanguage();
  initReputationFlip();
  initWhatIfSimulator();
  initKpis();
});
