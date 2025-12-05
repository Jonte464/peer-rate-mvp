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
    label: 'Förklara alltid saker väldigt enkelt (nybörjarnivå) och dela upp i små steg.',
    pill: 'Enkelt språk',
  },
  {
    id: 'rule-max-3-steps',
    label: 'Ge max 3 steg åt gången och fråga om jag vill ha nästa 3 steg.',
    pill: 'Max 3 steg',
  },
  {
    id: 'rule-no-hallucinations',
    label: 'Minimera hallucinationer: om information saknas ska agenten fråga istället för att hitta på.',
    pill: 'Anti-hallucination',
  },
  {
    id: 'rule-full-blocks',
    label: 'Ge alltid hela kodblock eller hela filer som kan klistras in direkt i VS Code.',
    pill: 'Hela kodblock',
  },
  {
    id: 'rule-ask-for-current-code',
    label: 'Be alltid först om nuvarande kod innan ny kod föreslås.',
    pill: 'Be om aktuell kod',
  },
  {
    id: 'rule-mentor-mode',
    label: 'Agera som mentor: rätta slarviga promptar och föreslå smartare lösningar före blind lydnad.',
    pill: 'Mentor-läge',
  },
  {
    id: 'rule-dependency-warnings',
    label: 'Varna när ändringar kan påverka beroenden, andra filer, routes eller databasen.',
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

// Lite HTML-escaping för trygg rendering i sammanfattningen
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
  let lines = [];

  if (activeRules.length > 0) {
    lines.push('<strong>Aktiva regler:</strong>');
    for (const text of activeRules) {
      lines.push(`• ${escapeHtml(text)}`);
    }
  } else {
    lines.push('Inga regler är aktiverade ännu.');
  }

  if (activeAutomations.length > 0) {
    lines.push('<br /><strong>Aktiva automatiseringar:</strong>');
    for (const text of activeAutomations) {
      lines.push(`• ${escapeHtml(text)}`);
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

  promptParts.push(
    'Du är en AI-assistent kopplad till projektet PeerRate (peerrate.ai). ' +
      'Du hjälper till med utveckling, kod, design och resonemang kring PeerRate-plattformen. ' +
      'Användaren är nybörjare och du ska vara mycket tydlig och pedagogisk.'
  );

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
        // Fallback
        promptOutputEl.select();
        document.execCommand('copy');
        alert('Prompten är kopierad (fallback-läge).');
      });
  } else {
    // Äldre fallback
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
  ];

  for (const id of allIds) {
    const element = el(id);
    if (!element) continue;
    const eventName = element.tagName === 'TEXTAREA' ? 'input' : 'change';
    element.addEventListener(eventName, updateSummaryAndPrompt);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', copyPromptToClipboard);
  }

  // Init första gången
  updateSummaryAndPrompt();
}

document.addEventListener('DOMContentLoaded', init);
