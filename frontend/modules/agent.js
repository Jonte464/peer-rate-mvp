// frontend/modules/agent.js
//
// Hanterar UI-logiken för PeerRate Agent-inställningar.
// Ingen AI-koppling ännu – vi bygger bara profiltexten
// som senare kan användas som system-prompt.

function el(id) {
  return document.getElementById(id);
}

const summaryTextEl = el('agent-summary-text');
const pillRowEl = el('agent-pill-row');
const promptOutputEl = el('agent-prompt-output');
const copyBtn = el('copy-prompt-btn');

const ruleConfig = [
  {
    id: 'rule-simple-language',
    label:
      'Förklara alltid saker väldigt enkelt och dela upp i små steg, särskilt vid kunskapsnivån “Nybörjare”.',
    pill: 'Enkelt språk',
  },
  {
    id: 'rule-max-3-steps',
    label: 'Ge max 3 steg åt gången och fråga om användaren vill ha nästa 3 steg.',
    pill: 'Max 3 steg',
  },
  {
    id: 'rule-no-hallucinations',
    label:
      'Minimera hallucinationer: om information saknas ska agenten fråga istället för att hitta på.',
    pill: 'Anti-hallucination',
  },
  {
    id: 'rule-full-blocks',
    label:
      'Ge alltid hela kodblock eller hela filer som kan klistras in direkt i VS Code.',
    pill: 'Hela kodblock',
  },
  {
    id: 'rule-ask-for-current-code',
    label:
      'Be alltid först om nuvarande kod innan ny kod föreslås (för att inte skriva över uppdateringar).',
    pill: 'Be om aktuell kod',
  },
  {
    id: 'rule-mentor-mode',
    label:
      'Agera som mentor: rätta slarviga promptar och föreslå smartare lösningar innan du följer den första idén.',
    pill: 'Mentor-läge',
  },
  {
    id: 'rule-dependency-warnings',
    label:
      'Varna när ändringar kan påverka beroenden, andra filer, routes eller databasen.',
    pill: 'Beroendevarningar',
  },
];

const automationConfig = [
  {
    id: 'auto-thread-length',
    label:
      'Föreslå ny tråd och skapa en kort sammanfattning när en konversation börjar bli lång eller “tung”.',
    pill: 'Automatisk trådhantering',
  },
  {
    id: 'auto-carry-summary',
    label: 'För alltid över nyckelinformation (manifest) till nästa tråd.',
    pill: 'För över manifest',
  },
  {
    id: 'auto-git-commands',
    label:
      'Avsluta större ändringar med färdiga Git-kommandon (PowerShell) för att pusha till GitHub/Render prod.',
    pill: 'Git-kommando i slutet',
  },
  {
    id: 'auto-vscode-friendly',
    label:
      'Anpassa alltid instruktioner till att användaren kör VS Code + GitHub + Render (peer-rate-prod).',
    pill: 'VS Code + Render',
  },
];

// Enkel HTML-escaping för sammanfattningen
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Bygg sammanfattning + piller + prompttext
function updateSummaryAndPrompt() {
  const activeRules = [];
  const activeAutomations = [];
  const pills = [];

  // Dropdown: kunskapsnivå
  const levelSelect = el('level-select');
  const levelValue = levelSelect ? levelSelect.value : 'beginner';

  let levelText;
  if (levelValue === 'beginner') {
    levelText = 'Användaren betraktas som nybörjare.';
  } else if (levelValue === 'intermediate') {
    levelText = 'Användaren har medelnivå (viss erfarenhet, men uppskattar tydlighet).';
  } else {
    levelText = 'Användaren har expertnivå (mer komprimerade förklaringar är okej).';
  }

  // Dropdown: stil på svar / grounding
  const styleSelect = el('answer-style-select');
  const styleValue = styleSelect ? styleSelect.value : 'reflective';

  let styleText;
  if (styleValue === 'reflective') {
    styleText =
      'Svar ska gärna innehålla resonemang, reflektioner och hypotetiska alternativ – men fortfarande vara rimliga.';
  } else {
    styleText =
      'Svar ska vara så strikta och icke-hallucinerande som möjligt, bygga på tydlig logik och, när det är relevant, hänvisa till källor eller tydliga antaganden.';
  }

  for (const cfg of ruleConfig) {
    const checkbox = el(cfg.id);
    if (checkbox && checkbox.checked) {
      activeRules.push(cfg.label);
      pills.push(cfg.pill);
    }
  }

  for (const cfg of automationConfig) {
    const checkbox = el(cfg.id);
    if (checkbox && checkbox.checked) {
      activeAutomations.push(cfg.label);
      pills.push(cfg.pill);
    }
  }

  const customRules = (el('rule-custom')?.value || '').trim();
  const customAutomation = (el('automation-custom')?.value || '').trim();

  // --- Sammanfattning (visuell) ---
  const lines = [];

  // Kunskapsnivå & stil först
  lines.push(
    '<strong>Kunnande:</strong> ' + escapeHtml(levelText)
  );
  lines.push(
    '<br /><strong>Svarstyp:</strong> ' + escapeHtml(styleText)
  );

  if (activeRules.length > 0) {
    lines.push('<br /><strong>Aktiva regler:</strong>');
    for (const text of activeRules) {
      lines.push('• ' + escapeHtml(text));
    }
  } else {
    lines.push('<br />Inga regler är aktiverade ännu.');
  }

  if (activeAutomations.length > 0) {
    lines.push('<br /><strong>Aktiva automatiseringar:</strong>');
    for (const text of activeAutomations) {
      lines.push('• ' + escapeHtml(text));
    }
  } else {
    lines.push('<br />Inga automatiseringar är aktiverade ännu.');
  }

  if (customRules) {
    lines.push(
      '<br /><strong>Egna regler:</strong><br />' + escapeHtml(customRules)
    );
  }

  if (customAutomation) {
    lines.push(
      '<br /><strong>Egna automatiseringsidéer:</strong><br />' +
        escapeHtml(customAutomation)
    );
  }

  summaryTextEl.innerHTML = lines.join('<br />');

  // Piller-taggar
  pillRowEl.innerHTML = '';
  for (const pill of pills) {
    const span = document.createElement('span');
    span.className = 'agent-pill';
    span.textContent = pill;
    pillRowEl.appendChild(span);
  }

  // --- Genererad prompttext (för ChatGPT/API) ---

  const promptParts = [];

  // Grundintroduktion
  promptParts.push(
    'Du är en AI-assistent kopplad till projektet PeerRate (peerrate.ai). ' +
      'Du hjälper till med utveckling, kod, design och resonemang kring PeerRate-plattformen.'
  );

  // Nivå
  if (levelValue === 'beginner') {
    promptParts.push(
      '\n\nKunskapsnivå: Användaren är nybörjare. ' +
        'Förklara därför saker långsamt, steg-för-steg, undvik fackspråk eller förklara det tydligt.'
    );
  } else if (levelValue === 'intermediate') {
    promptParts.push(
      '\n\nKunskapsnivå: Användaren har medelnivå. ' +
        'Du kan använda visst fackspråk men behåll tydlighet och ge exempel.'
    );
  } else {
    promptParts.push(
      '\n\nKunskapsnivå: Användaren är expert. ' +
        'Du kan vara mer komprimerad, men fortfarande strukturerad och tydlig.'
    );
  }

  // Stil / grounding
  if (styleValue === 'reflective') {
    promptParts.push(
      '\n\nSvarsstil: Var reflekterande och resonemangsdriven. ' +
        'Du får föreslå hypotetiska alternativ och tänka högt, men var tydlig med vad som är fakta och vad som är antaganden.'
    );
  } else {
    promptParts.push(
      '\n\nSvarsstil: Var så strikt och icke-hallucinerande som möjligt. ' +
        'Om du är osäker ska du säga det. Bygg svaren på tydlig logik, pålitlig kunskap och markera tydligt när något är en uppskattning eller begränsad kunskap.'
    );
  }

  if (activeRules.length > 0) {
    promptParts.push(
      '\n\nFöljande regler ska du alltid följa:\n- ' +
        activeRules.join('\n- ')
    );
  }

  if (activeAutomations.length > 0) {
    promptParts.push(
      '\n\nFöljande automatiska beteenden ska du efterlikna i dina svar (så långt det går i denna miljö):\n- ' +
        activeAutomations.join('\n- ')
    );
  }

  if (customRules) {
    promptParts.push('\n\nYtterligare särskilda regler:\n' + customRules);
  }

  if (customAutomation) {
    promptParts.push(
      '\n\nIdéer/önskemål för automatisering som du ska ta hänsyn till när du planerar arbetssättet:\n' +
        customAutomation
    );
  }

  // Kodinstruktioner
  promptParts.push(
    '\n\nNär du ger instruktioner om kod ska du i möjligaste mån ge hela kodblock eller hela filer ' +
      'som användaren kan klistra direkt in i VS Code. ' +
      'Avsluta gärna större ändringar med förslag på git-kommandon (PowerShell) för att pusha till main.'
  );

  promptOutputEl.value = promptParts.join('');
}

// Kopiera prompt till urklipp
function copyPromptToClipboard() {
  const text = promptOutputEl.value || '';
  if (!text.trim()) {
    alert('Det finns ingen genererad prompt att kopiera ännu.');
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert('Prompten är kopierad till urklipp.');
      })
      .catch(() => {
        promptOutputEl.select();
        document.execCommand('copy');
        alert('Prompten är kopierad (fallback-läge).');
      });
  } else {
    promptOutputEl.select();
    document.execCommand('copy');
    alert('Prompten är kopierad (fallback-läge).');
  }
}

function init() {
  const allIds = [
    ...ruleConfig.map((r) => r.id),
    ...automationConfig.map((a) => a.id),
    'rule-custom',
    'automation-custom',
    'level-select',
    'answer-style-select',
  ];

  for (const id of allIds) {
    const element = el(id);
    if (!element) continue;

    const eventName =
      element.tagName === 'TEXTAREA' || element.tagName === 'SELECT'
        ? 'input'
        : 'change';

    // För select är det bättre med 'change'
    if (element.tagName === 'SELECT') {
      element.addEventListener('change', updateSummaryAndPrompt);
    } else {
      element.addEventListener(eventName, updateSummaryAndPrompt);
    }
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', copyPromptToClipboard);
  }

  // Init första gången
  updateSummaryAndPrompt();
}

document.addEventListener('DOMContentLoaded', init);
