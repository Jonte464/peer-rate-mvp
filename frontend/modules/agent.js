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
// ===== Agent-chat UI =====
const agentUserInputEl = el('agent-user-input');
const agentSendBtn = el('agent-send-btn');
const agentResponseEl = el('agent-response');


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

  // ===== Språk & pedagogik =====
  const levelValue = (el('level-select') || {}).value || 'beginner';
  const styleValue = (el('answer-style-select') || {}).value || 'reflective';
  const stepsValue = (el('steps-select') || {}).value || '3';

  let levelText;
  if (levelValue === 'beginner') {
    levelText = 'Användaren betraktas som nybörjare.';
  } else if (levelValue === 'intermediate') {
    levelText = 'Användaren har medelnivå (viss erfarenhet, men uppskattar tydlighet).';
  } else {
    levelText = 'Användaren har expertnivå (mer komprimerade förklaringar är okej).';
  }

  let styleText;
  if (styleValue === 'reflective') {
    styleText =
      'Svar ska innehålla resonemang, reflektioner och ibland hypotetiska alternativ – men fortfarande vara rimliga.';
  } else {
    styleText =
      'Svar ska vara så strikta och icke-hallucinerande som möjligt, bygga på tydlig logik och markera osäkerhet tydligt.';
  }

  const stepsText =
    'Agenten ska normalt dela upp instruktioner i högst ' +
    stepsValue +
    ' tydliga steg per svar.';

  // ===== Svarslayout =====
  const lengthValue = (el('answer-length-select') || {}).value || 'medium';
  const formatValue = (el('answer-format-select') || {}).value || 'steps';
  const exampleValue = (el('example-level-select') || {}).value || 'some';

  let lengthText;
  if (lengthValue === 'short') {
    lengthText = 'Svarslängd: korta, komprimerade svar.';
  } else if (lengthValue === 'medium') {
    lengthText = 'Svarslängd: medellånga svar med balans mellan korthet och detaljer.';
  } else {
    lengthText = 'Svarslängd: gärna längre svar med mycket detaljer och förklaringar.';
  }

  let formatText;
  if (formatValue === 'steps') {
    formatText = 'Format: steg-för-steg-lista.';
  } else if (formatValue === 'summary-details') {
    formatText = 'Format: kort sammanfattning överst, detaljer under.';
  } else if (formatValue === 'code-first') {
    formatText = 'Format: visa kod först, sedan förklaring.';
  } else {
    formatText = 'Format: först förklaring, sedan kod.';
  }

  let exampleText;
  if (exampleValue === 'none') {
    exampleText = 'Exempel: undvik exempel om inte användaren ber om det.';
  } else if (exampleValue === 'some') {
    exampleText = 'Exempel: ge några exempel när det hjälper förståelsen.';
  } else {
    exampleText = 'Exempel: ge gärna många exempel och use-cases.';
  }

  // ===== Kod & säkerhet / oklarheter =====
  const uncertaintyValue =
    (el('uncertainty-select') || {}).value || 'ask';
  let uncertaintyText;
  if (uncertaintyValue === 'ask') {
    uncertaintyText =
      'Vid oklarheter: ställ följdfrågor istället för att anta.';
  } else if (uncertaintyValue === 'assume-annotated') {
    uncertaintyText =
      'Vid oklarheter: gör rimliga antaganden, men markera dem tydligt.';
  } else {
    uncertaintyText =
      'Vid oklarheter: gör så få antaganden som möjligt, lämna hellre öppna frågor.';
  }

  // ===== Mentorskap & initiativ =====
  const mentorValue =
    (el('mentor-level-select') || {}).value || 'soft';
  const initiativeValue =
    (el('initiative-select') || {}).value || 'follow';

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

  let initiativeText;
  if (initiativeValue === 'follow') {
    initiativeText =
      'Initiativnivå: följ användarens instruktioner ganska strikt, föreslå bara alternativ när något verkar uppenbart problematiskt.';
  } else if (initiativeValue === 'balanced') {
    initiativeText =
      'Initiativnivå: balans – följ instruktioner men föreslå förbättringar när de är tydligt vettiga.';
  } else {
    initiativeText =
      'Initiativnivå: väldigt proaktiv – kom gärna med egna idéer, förbättringar och frågor.';
  }

  // ===== Trådar & kontext =====
  const threadValue =
    (el('thread-threshold-select') || {}).value || 'medium';
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

  // ===== Kodstil & kvalitet =====
  const codeStyleValue =
    (el('code-style-select') || {}).value || 'simple';
  const testsValue = (el('tests-select') || {}).value || 'basic';
  const loggingValue =
    (el('logging-select') || {}).value || 'minimal';
  const errorHandlingValue =
    (el('error-handling-select') || {}).value || 'standard';

  let codeStyleText;
  if (codeStyleValue === 'simple') {
    codeStyleText =
      'Kodstil: så enkel som möjligt, hellre lite enklare än överdesignad.';
  } else if (codeStyleValue === 'balanced') {
    codeStyleText =
      'Kodstil: balans – rimligt strukturerad och underhållbar.';
  } else {
    codeStyleText =
      'Kodstil: avancerad – gärna patterns, abstraktioner och hög kodkvalitet.';
  }

  let testsText;
  if (testsValue === 'none') {
    testsText =
      'Tester: skapa normalt sett inga tester om inte användaren ber om det.';
  } else if (testsValue === 'basic') {
    testsText =
      'Tester: föreslå enkla tester eller testidéer vid större ändringar.';
  } else {
    testsText =
      'Tester: försök alltid skissa en teststrategi eller lämpliga tester.';
  }

  let loggingText;
  if (loggingValue === 'minimal') {
    loggingText = 'Logging: minimal – bara det nödvändigaste.';
  } else if (loggingValue === 'diagnostic') {
    loggingText =
      'Logging: gärna extra logging för felsökning där det är rimligt.';
  } else {
    loggingText =
      'Logging: undvik ny logging om det inte verkligen behövs.';
  }

  let errorHandlingText;
  if (errorHandlingValue === 'minimal') {
    errorHandlingText =
      'Felhantering: minimal, fokus på happy path.';
  } else if (errorHandlingValue === 'standard') {
    errorHandlingText =
      'Felhantering: standard – rimlig och balanserad felhantering.';
  } else {
    errorHandlingText =
      'Felhantering: defensiv – validera mycket och lägg in fler kontroller.';
  }

  // ===== Scope-begränsningar =====
  const scopeNoDb = !!(el('scope-no-db-schema') || {}).checked;
  const scopeNoAuth = !!(el('scope-no-auth') || {}).checked;
  const scopeNoUI = !!(el('scope-no-major-ui') || {}).checked;
  const scopeNoDeps = !!(el('scope-no-new-deps') || {}).checked;

  const scopeLines = [];
  if (scopeNoDb) scopeLines.push('Ändra inte databas-schema utan uttryckligt OK.');
  if (scopeNoAuth) scopeLines.push('Rör inte autentisering/säkerhetslogik utan tydligt godkännande.');
  if (scopeNoUI) scopeLines.push('Gör inga större UI-ombyggnader, bara små förbättringar.');
  if (scopeNoDeps) scopeLines.push('Lägg inte till nya externa beroenden utan att först få OK.');

  // ===== Git & risk =====
  const gitValue = (el('git-mode-select') || {}).value || 'always';
  const showRisks = !!(el('toggle-show-risks') || {}).checked;
  const finalSummary = !!(el('toggle-final-summary') || {}).checked;

  let gitText;
  if (gitValue === 'always') {
    gitText =
      'Efter kodändringar ska git-kommandon nästan alltid föreslås som avslutning.';
  } else if (gitValue === 'big') {
    gitText =
      'Git-kommandon föreslås främst vid större kodändringar eller när nya filer tillkommer.';
  } else {
    gitText =
      'Git-kommandon föreslås normalt inte automatiskt om inte användaren ber om det.';
  }

  // ===== Preset =====
  const presetValue = (el('preset-select') || {}).value || 'none';
  let presetText = '';
  if (presetValue === 'safe-beginner') {
    presetText =
      'Preset: trygg nybörjar-mode – prioritera tydlighet, säkerhet och små steg.';
  } else if (presetValue === 'build-fast') {
    presetText =
      'Preset: bygg kod snabbt – var mer pragmatisk, föreslå lösningar som fungerar snabbt (utan att offra säkerhet).';
  } else if (presetValue === 'code-review') {
    presetText =
      'Preset: kod-review – fokusera mer på granskning och förbättring av befintlig kod än på helt ny funktionalitet.';
  }

  // ===== Checkbox-regler & automationer =====
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

  // ===== Sammanfattning (visuell) =====
  const lines = [];

  lines.push('<strong>Kunnande:</strong> ' + escapeHtml(levelText));
  lines.push('<br /><strong>Svarstyp:</strong> ' + escapeHtml(styleText));
  lines.push('<br /><strong>Steg per svar:</strong> ' + escapeHtml(stepsText));
  lines.push('<br /><strong>Svarslängd:</strong> ' + escapeHtml(lengthText));
  lines.push('<br /><strong>Format:</strong> ' + escapeHtml(formatText));
  lines.push('<br /><strong>Exempelnivå:</strong> ' + escapeHtml(exampleText));
  lines.push('<br /><strong>Otydlighet:</strong> ' + escapeHtml(uncertaintyText));
  lines.push('<br /><strong>Mentorskap:</strong> ' + escapeHtml(mentorLevelText));
  lines.push('<br /><strong>Initiativ:</strong> ' + escapeHtml(initiativeText));
  lines.push('<br /><strong>Trådhantering:</strong> ' + escapeHtml(threadText));
  lines.push('<br /><strong>Kodstil:</strong> ' + escapeHtml(codeStyleText));
  lines.push('<br /><strong>Tester:</strong> ' + escapeHtml(testsText));
  lines.push('<br /><strong>Logging:</strong> ' + escapeHtml(loggingText));
  lines.push('<br /><strong>Felhantering:</strong> ' + escapeHtml(errorHandlingText));
  lines.push('<br /><strong>Git:</strong> ' + escapeHtml(gitText));

  if (scopeLines.length > 0) {
    lines.push('<br /><strong>Scope-begränsningar:</strong>');
    for (const s of scopeLines) {
      lines.push('• ' + escapeHtml(s));
    }
  }

  if (presetText) {
    lines.push('<br /><strong>Preset:</strong> ' + escapeHtml(presetText));
  }

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

  if (showRisks) {
    lines.push(
      '<br /><strong>Riskmedvetenhet:</strong> Agenten ska vid större ändringar alltid nämna risker/saker att tänka på.'
    );
  }

  if (finalSummary) {
    lines.push(
      '<br /><strong>Sammanfattning:</strong> Agenten ska avsluta längre svar med en kort sammanfattning.'
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

  // ===== Genererad prompttext (för ChatGPT/API) =====
  const promptParts = [];

  // Grundintroduktion
  promptParts.push(
    'Du är en AI-assistent kopplad till projektet PeerRate (peerrate.ai). ' +
      'Du hjälper till med utveckling, kod, design och resonemang kring PeerRate-plattformen.'
  );

  // Kunskapsnivå
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

  // Svarsstil / grounding
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

  // Svarslayout
  promptParts.push('\n\n' + lengthText);
  promptParts.push('\n' + formatText);
  promptParts.push('\n' + exampleText);

  // Otydlighet
  promptParts.push('\n\nOtydlighet/oklarheter: ' + uncertaintyText);

  // Mentorskap & initiativ
  promptParts.push('\n\n' + mentorLevelText);
  promptParts.push('\n' + initiativeText);

  // Trådhantering
  promptParts.push('\n\nTrådhantering: ' + threadText);

  // Kodstil & kvalitet
  promptParts.push('\n\n' + codeStyleText);
  promptParts.push('\n' + testsText);
  promptParts.push('\n' + loggingText);
  promptParts.push('\n' + errorHandlingText);

  // Scope-begränsningar
  if (scopeLines.length > 0) {
    promptParts.push(
      '\n\nScope-begränsningar (respektera dessa och be om tillstånd innan du bryter mot dem):\n- ' +
        scopeLines.join('\n- ')
    );
  }

  // Git-hantering
  promptParts.push('\n\nGit-hantering: ' + gitText);

  // Preset
  if (presetText) {
    promptParts.push('\n\nPreset (övergripande roll): ' + presetText);
  }

  // Regler & automationer
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

  if (showRisks) {
    promptParts.push(
      '\n\nVid större förändringar ska du alltid inkludera en kort sektion om risker/saker att tänka på.'
    );
  }

  if (finalSummary) {
    promptParts.push(
      '\n\nVid längre svar ska du avsluta med en mycket kort sammanfattning.'
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
    // Spara prompten så chat-sidan kan använda den
  try {
    localStorage.setItem('peerRateAgentSystemPrompt', promptOutputEl.value || '');
  } catch {}
}

// ==============================
// Skicka fråga till PeerRate-agenten
// ==============================
async function sendQuestionToAgent() {
  const systemPrompt = promptOutputEl?.value || '';
  const userPrompt = agentUserInputEl?.value || '';

  if (!systemPrompt.trim()) {
    alert('Ingen agent-prompt är genererad ännu.');
    return;
  }

  if (!userPrompt.trim()) {
    alert('Skriv en fråga till agenten först.');
    return;
  }

  agentResponseEl.style.display = 'block';
  agentResponseEl.textContent = '⏳ Tänker...';

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt,
        userPrompt,
      }),
    });

    const json = await res.json();

    if (!json.ok) {
      agentResponseEl.textContent =
        '❌ Fel från agenten:\n' + (json.error || 'Okänt fel');
      return;
    }

    agentResponseEl.textContent = json.answer || '(Inget svar)';
  } catch (err) {
    console.error('Agent chat error', err);
    agentResponseEl.textContent =
      '❌ Kunde inte nå agenten. Se konsolen för detaljer.';
  }
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
    // checkbox-regler
    ...ruleConfig.map((r) => r.id),
    ...automationConfig.map((a) => a.id),
    // textareas
    'rule-custom',
    'automation-custom',
    // dropdowns
    'level-select',
    'answer-style-select',
    'steps-select',
    'answer-length-select',
    'answer-format-select',
    'example-level-select',
    'uncertainty-select',
    'mentor-level-select',
    'initiative-select',
    'thread-threshold-select',
    'code-style-select',
    'tests-select',
    'logging-select',
    'error-handling-select',
    'git-mode-select',
    'preset-select',
    // scope & toggles
    'scope-no-db-schema',
    'scope-no-auth',
    'scope-no-major-ui',
    'scope-no-new-deps',
    'toggle-show-risks',
    'toggle-final-summary',
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

  // Agent-chat
  if (agentSendBtn) {
    agentSendBtn.addEventListener('click', sendQuestionToAgent);
  }

  // Init första gången
  updateSummaryAndPrompt();
}

document.addEventListener('DOMContentLoaded', init);
