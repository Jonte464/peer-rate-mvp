// frontend/modules/agentChat.js
// Enkel chatt-UI som skickar till backend: POST /api/agent/chat
// Systemprompt hämtas från localStorage där agent.js sparar den.

function el(id) {
  return document.getElementById(id);
}

const systemEl = el('systemPrompt');
const userEl = el('userPrompt');
const sendBtn = el('sendBtn');
const clearBtn = el('clearBtn');
const statusText = el('statusText');
const chatLog = el('chatLog');

const LS_SYSTEM_PROMPT_KEY = 'peerRateAgentSystemPrompt';
const LS_CHAT_LOG_KEY = 'peerRateAgentChatLog_v1';

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function setStatus(msg) {
  statusText.textContent = msg || '';
}

function scrollToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function addBubble(role, text) {
  const div = document.createElement('div');
  div.className = `bubble ${role === 'user' ? 'user' : 'assistant'}`;
  div.textContent = text || '';
  chatLog.appendChild(div);
  scrollToBottom();
}

function loadChatLog() {
  const raw = localStorage.getItem(LS_CHAT_LOG_KEY);
  const data = safeJsonParse(raw);
  if (!Array.isArray(data)) return;
  for (const m of data) {
    if (!m || !m.role) continue;
    addBubble(m.role, m.text || '');
  }
  scrollToBottom();
}

function saveChatLogEntry(role, text) {
  const raw = localStorage.getItem(LS_CHAT_LOG_KEY);
  const data = safeJsonParse(raw);
  const arr = Array.isArray(data) ? data : [];
  arr.push({ role, text, at: new Date().toISOString() });
  localStorage.setItem(LS_CHAT_LOG_KEY, JSON.stringify(arr));
}

function clearChatLog() {
  localStorage.removeItem(LS_CHAT_LOG_KEY);
  chatLog.innerHTML = '';
}

function loadSystemPrompt() {
  const sp = localStorage.getItem(LS_SYSTEM_PROMPT_KEY) || '';
  systemEl.value =
    sp.trim() ||
    '(Ingen sparad system-prompt ännu. Gå till inställningar och ändra något.)';
}

async function sendMessage() {
  const systemPrompt = (localStorage.getItem(LS_SYSTEM_PROMPT_KEY) || '').trim();
  const userPrompt = (userEl.value || '').trim();

  if (!userPrompt) {
    setStatus('Skriv ett meddelande först.');
    return;
  }

  setStatus('Skickar...');
  sendBtn.disabled = true;

  // UI direkt
  addBubble('user', userPrompt);
  saveChatLogEntry('user', userPrompt);

  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: systemPrompt || 'Du är en hjälpsam assistent.',
        userPrompt,
      }),
      credentials: 'include',
    });

    const json = await res.json().catch(() => null);

    if (!json || json.ok === false) {
      const err = json?.error || `HTTP ${res.status}`;
      addBubble('assistant', `❌ Fel: ${err}`);
      saveChatLogEntry('assistant', `❌ Fel: ${err}`);
      setStatus('Fel.');
      return;
    }

    const answer = json.answer || '(tomt svar)';
    addBubble('assistant', answer);
    saveChatLogEntry('assistant', answer);

    setStatus('Klart.');
    userEl.value = '';
    userEl.focus();
  } catch (e) {
    addBubble('assistant', `❌ Nätverksfel: ${e?.message || e}`);
    saveChatLogEntry('assistant', `❌ Nätverksfel: ${e?.message || e}`);
    setStatus('Nätverksfel.');
  } finally {
    sendBtn.disabled = false;
    setTimeout(() => setStatus(''), 1200);
    scrollToBottom();
  }
}

function init() {
  loadSystemPrompt();
  loadChatLog();

  sendBtn.addEventListener('click', sendMessage);

  clearBtn.addEventListener('click', () => {
    clearChatLog();
    setStatus('Rensat.');
    setTimeout(() => setStatus(''), 900);
  });

  // ChatGPT-likt:
  // Enter = skicka
  // Shift+Enter = ny rad
  userEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Om man ändrar inställningar i annan flik → uppdatera systemprompt
  window.addEventListener('storage', (e) => {
    if (e.key === LS_SYSTEM_PROMPT_KEY) loadSystemPrompt();
  });

  // Starta med fokus i input
  userEl.focus();
  scrollToBottom();
}

document.addEventListener('DOMContentLoaded', init);
