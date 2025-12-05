// frontend/modules/agent.js
//
// Enkel första version av logik för PeerRate Agent UI.
// Just nu finns ingen koppling till OpenAI API.
// Vi fokuserar bara på att läsa av valet av regler + automation
// och visa en tydlig sammanfattning.

function el(id) {
  return document.getElementById(id);
}

const summaryTextEl = el('agent-summary-text');
const pillRowEl = el('agent-pill-row');

// Alla “regler” vi vill bevaka
const ruleConfig = [
  {
    id: 'rule-simple-language',
    label: 'Förklara saker väldigt enkelt (nybörjarnivå).',
    pill: 'Enkelt språk',
    group: 'Regler',
  },
  {
    id: 'rule-max-3-steps',
    label: 'Ge max 3 steg åt gången och fråga om nästa.',
    pill: 'Max 3 steg',
    group: 'Regler',
  },
  {
    id: 'rule-no-hallucinations',
    label: 'Minimera hallucinationer, fråga när information saknas.',
    pill: 'Anti-hallucination',
    group: 'Kod & säkerhet',
  },
  {
    id: 'rule-full-blocks',
    label: 'Leverera hela kodblock/filer som kan klistras in direkt.',
    pill: 'Hela kodblock',
    group: 'Kod & säkerhet',
  },
  {
    id: 'rule-ask-for-current-code',
    label: 'Be alltid om nuvarande kod innan du ger ny kod.',
    pill: 'Be om aktuell kod',
    group: 'Kod & säkerhet',
  },
  {
    id: 'rule-mentor-mode',
    label: 'Agera mentor och föreslå smartare lösningar.',
    pill: 'Mentor-läge',
    group: 'Mentorskap',
  },
  {
    id: 'rule-dependency-warnings',
    label: 'Varna om ändringar kan påverka beroenden/andra delar.',
    pill: 'Beroendevarningar',
    group: 'Mentorskap',
  },
];

// Alla “automatiseringar” vi vill bevaka
const automationConfig = [
  {
    id: 'auto-thread-length',
    label:
      'Föreslå ny tråd + sammanfattning när konversationen blir lång/tung.',
    pill: 'Automatisk trådhantering',
    group: 'Tråd & kontext',
  },
  {
    id: 'auto-carry-summary',
    label: 'För över nyckelinformation automatiskt till nästa tråd.',
    pill: 'För över manifest',
    group: 'Tråd & kontext',
  },
  {
    id: 'auto-git-commands',
    label:
      'Avsluta ändringar med färdiga Git-kommandon (PowerShell) för deploy.',
    pill: 'Git-kommando i slutet',
    group: 'Kod & utveckling',
  },
  {
    id: 'auto-vscode-friendly',
    label:
      'Anpassa alltid instruktioner till VS Code + GitHub + Render prod.',
    pill: 'VS Code + Render',
    group: 'Kod & utveckling',
  },
];

// Läser alla checkboxar + fritext och uppdaterar sammanfattningen
function updateSummary() {
  const activeRules = [];
  const activeAutomations = [];
  const pills = [];

  // Regler
  for (const cfg of ruleConfig) {
    const checkbox = el(cfg.id);
    if (checkbox && checkbox.checked) {
      activeRules.push({ group: cfg.group, text: cfg.label });
      pills.push(cfg.pill);
    }
  }

  // Automatiseringar
  for (const cfg of automationConfig) {
    const checkbox = el(cfg.id);
    if (checkbox && checkbox.checked) {
      activeAutomations.push({ group: cfg.group, text: cfg.label });
      pills.push(cfg.pill);
    }
  }

  const customRules = (el('rule-custom')?.value || '').trim();
  const customAutomation = (el('automation-custom')?.value || '').trim();

  let lines = [];

  if (activeRules.length > 0) {
    lines.push('<strong>Aktiva regler:</strong>');
    lines = lines.concat(
      activeRules.map(
        (r) => `• (${r.group}) ${escapeHtml(r.text)}`
      )
    );
  } else {
    lines.push('Inga regler är aktiverade ännu.');
  }

  if (activeAutomations.length > 0) {
    lines.push('<br /><strong>Aktiva automatiseringar:</strong>');
    lines = lines.concat(
      activeAutomations.map(
        (a) => `• (${a.group}) ${escapeHtml(a.text)}`
      )
    );
  } else {
    lines.push(
      '<br />Inga automatiseringar är aktiverade ännu.'
    );
  }

  if (customRules) {
    lines.push(
      '<br /><strong>Egna regler:</strong><br />' +
        escapeHtml(customRules)
    );
  }

  if (customAutomation) {
    lines.push(
      '<br /><strong>Egna automatiseringsidéer:</strong><br />' +
        escapeHtml(customAutomation)
    );
  }

  summaryTextEl.innerHTML = lines.join('<br />');

  // Uppdatera små “pills”
  pillRowEl.innerHTML = '';
  for (const pillText of pills) {
    const span = document.createElement('span');
    span.className = 'agent-pill';
    span.textContent = pillText;
    pillRowEl.appendChild(span);
  }
}

// Enkel HTML-escaping
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Sätt event-lyssnare
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

    const eventName =
      element.tagName === 'TEXTAREA' ? 'input' : 'change';

    element.addEventListener(eventName, updateSummary);
  }

  // Kör en första uppdatering så att sidan inte ser tom ut
  updateSummary();
}

document.addEventListener('DOMContentLoaded', init);
