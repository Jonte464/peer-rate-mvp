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

  // Kunskapsnivå
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

  // Svarsstil / grounding
  const styleSelect = el('answer-style-select');
  const styleValue = styleSelect ? styleSelect.value : 'reflective';
  let styleText;
  if (styleValue === 'reflective') {
    styleText =
      'Svar ska innehålla resonemang, reflektioner och ibland hypotetiska alternativ – men fortfarande vara rimliga.';
  } else {
    styleText =
      'Svar ska vara så strikta och icke-hallucinerande som möjligt, bygga på tydlig logik och markera osäkerhet tydligt.';
  }

  // Max antal steg per svar
  const stepsSelect = el('steps-select');
  const stepsValue = stepsSelect ? stepsSelect.value : '3';
  const stepsText =
    'Agenten ska normalt dela upp instruktioner i högst ' +
    stepsValue +
    ' tydliga steg per svar.';

  // Mentor-nivå
  const mentorSelect = el('mentor-level-select');
  const mentorValue = mentorSelect ? mentorSelect.value : 'soft';
  let mentorLevelText;
  if (mentorValue === 'soft') {
    mentorLevelText =
      'Mentorstil: mjuk coach, stödjande och försiktig feedback.';
  } else if (mentorValue === 'balanced') {
    mentorLevelText =
      'Mentorstil: balanserad – ärlig men vänlig, tydlig utan att vara hård.';
  } else {
    mentorLevelText =
      'Mentorstil: direkt – väldigt tydlig och rakt på sak, men fortfarande respektfull.';
  }

  // När föreslå ny tråd
  const threadSelect = el('thread-threshold-select');
  const threadValue = threadSelect ? threadSelect.value : 'medium';
  let threadText;
  if (threadValue === 'manual') {
    threadText =
      'Ny tråd föreslås endast när användaren uttryckligen ber om det.';
  } else if (threadValue === 'short') {
    threadText =
      'Ny tråd kan föreslås redan vid kortare trådar (ca 30 meddelanden).';
  } else if (threadValue === 'medium') {
    threadText =
      'Ny tråd föreslås vid medellånga trådar (ca 60 meddelanden).';
  } else {
    threadText =
      'Ny tråd föreslås först vid väldigt långa trådar (ca 100+ meddelanden).';
  }

  // Git-kommandon
  const gitSelect = el('git-mode-select');
  const gitValue = gitSelect ? gitSelect.value : 'always';
  let gitText;
  if (gitValue === 'always') {
    gitText =
      'Efter kodändringar ska git-kommandon nästan alltid föreslås som avslutning.';
  } else if (gitValue === 'big') {
    gitText =
      'Git-kommandon föreslås främst vid större kodändringar eller när nya filer tillkommer.';
  } else {
    gitText =
      'Git-kommandon föreslås normalt inte automatiskt, om inte användaren ber om det.';
  }

  // Checkbox-regler
  for (const cfg of ruleConfig) {
    const checkbox = el(cfg.id);
    if (checkbox && checkbox.checked) {
      activeRules.push(cfg.label);
      pills.push(cfg.pill);
    }
  }

  // Checkbox-automationer
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

  lines.push(
    '<strong>Kunnande:</strong> ' + escapeHtml(levelText)
  );
  lines.push(
    '<br /><strong>Svarstyp:</strong> ' + escapeHtml(styleText)
  );
  lines.push(
    '<br /><strong>Steg per svar:</strong> ' + escapeHtml(stepsText)
  );
  lines.push(
    '<br /><strong>Mentorskap:</strong> ' + escapeHtml(mentorLevelText)
  );
  lines.push(
    '<br /><strong>Trådhantering:</strong> ' + escapeHtml(threadText)
  );
  lines.push(
    '<br /><strong>Git-hantering:</strong> ' + escapeHtml(gitText)
  );

  if (activeRules.length > 0) {
    lines.push('<br /><strong>Aktiva regler:</strong>');
    for (const text of activeRules) {
      lines.push('• ' + escapeHtml(text));
    }
  }

  if (activeAutomations.length > 0) {
    lines.push('<br /><strong>Aktiva automatiseringar:</strong>');
    for (const text of activeAutomations) {
      lines.push('• ' + escapeHtml(text));
    }
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

  // Svarsstil
  if (styleValue === 'reflective') {
    promptParts.push(
      '\n\nSvarsstil: Var reflekterande och resonemangsdriven. ' +
        'Du får föreslå hypotetiska alternativ och tänka högt, men var tydlig med vad som är fakta och vad som är antaganden.'
    );
  } else {
    promptParts.push(
      '\n\nSvarsstil: Var så strikt och icke-hallucinerande som möjligt. ' +
        'Om du är osäker ska du säga det. Bygg svaren på tydlig logik, pålitlig kunskap och markera tydligt när något är en uppskattning.'
    );
  }

  // Steg per svar
  promptParts.push(
    '\n\nSteg per svar: Försök normalt dela upp instruktioner i högst ' +
      stepsValue +
      ' tydliga steg per svar, om inte användaren ber om något annat.'
  );

  // Mentorstil
  promptParts.push('\n\n' + mentorLevelText);

  // Trådhantering
  promptParts.push('\n\nTrådhantering: ' + threadText);

  // Git-hantering
  promptParts.push('\n\nGit-hantering: ' + gitText);

  // Checkbox-regler
  if (activeRules.length > 0) {
    promptParts.push(
      '\n\nFöljande regler ska du alltid följa:\n- ' +
        activeRules.join('\n- ')
    );
  }

  // Checkbox-automationer
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
      'Avsluta gärna större ändringar med förslag på git-kommandon (PowerShell) för att pusha till main – ' +
      'om detta inte strider mot inställningen för git-hantering ovan.'
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
    'steps-select',
    'mentor-level-select',
    'thread-threshold-select',
    'git-mode-select',
  ];

  for (const id of allIds) {
    const element = el(id);
    if (!element) continue;

    if (element.tagName === 'TEXTAREA') {
      element.addEventListener('input', updateSummaryAndPrompt);
    } else if (element.tagName === 'SELECT') {
      element.addEventListener('change', updateSummaryAndPrompt);
    } else {
      element.addEventListener('change', updateSummaryAndPrompt);
    }
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', copyPromptToClipboard);
  }

  // Init första gången
  updateSummaryAndPrompt();
}

document.addEventListener('DOMContentLoaded', init);
