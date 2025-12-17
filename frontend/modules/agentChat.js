// frontend/modules/agentChat.js
// ChatGPT-lik chat: flera trådar i vänsterpanel (localStorage)
// + fortsätter prata med backend: POST /api/agent/chat

function el(id) {
  return document.getElementById(id);
}

const systemEl = el('systemPrompt');
const userEl = el('userPrompt');
const sendBtn = el('sendBtn');
const clearBtn = el('clearBtn');
const statusText = el('statusText');
const chatLog = el('chatLog');

// NYA UI-element (kommer i agent-chat.html i steg 2)
const threadListEl = el('threadList');
const newThreadBtn = el('newThreadBtn');
const deleteThreadBtn = el('deleteThreadBtn');
const threadTitleEl = el('threadTitle');

const LS_SYSTEM_PROMPT_KEY = 'peerRateAgentSystemPrompt';

// NYTT: trådmodellen (v1)
const LS_THREADS_KEY = 'peerRateAgentThreads_v1';
const LS_ACTIVE_THREAD_KEY = 'peerRateAgentActiveThreadId_v1';

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

function loadSystemPrompt() {
  const sp = localStorage.getItem(LS_SYSTEM_PROMPT_KEY) || '';
  systemEl.value =
    sp.trim() ||
    '(Ingen sparad system-prompt ännu. Gå till inställningar och ändra något.)';
}

/**
 * THREADS
 * threads: [
 *   { id, title, createdAt, updatedAt, messages: [{role,text,at}] }
 * ]
 */

function loadThreads() {
  const raw = localStorage.getItem(LS_THREADS_KEY);
  const data = safeJsonParse(raw);
  return Array.isArray(data) ? data : [];
}

function saveThreads(threads) {
  localStorage.setItem(LS_THREADS_KEY, JSON.stringify(threads || []));
}

function getActiveThreadId() {
  return localStorage.getItem(LS_ACTIVE_THREAD_KEY) || '';
}

function setActiveThreadId(id) {
  localStorage.setItem(LS_ACTIVE_THREAD_KEY, id);
}

function makeId() {
  return 't_' + Math.random().toString(16).slice(2) + '_' + Date.now();
}

function makeTitleFromText(text) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (!t) return 'Ny konversation';
  return t.length > 28 ? t.slice(0, 28) + '…' : t;
}

function ensureDefaultThread() {
  const threads = loadThreads();
  const activeId = getActiveThreadId();

  if (threads.length === 0) {
    const id = makeId();
    const newThread = {
      id,
      title: 'Ny konversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    saveThreads([newThread]);
    setActiveThreadId(id);
    return;
  }

  // Om aktiv tråd saknas, välj senaste
  const exists = threads.some(t => t.id === activeId);
  if (!exists) {
    setActiveThreadId(threads[0].id);
  }
}

function getActiveThread(threads) {
  const id = getActiveThreadId();
  return threads.find(t => t.id === id) || null;
}

function renderThreadList() {
  if (!threadListEl) return;

  const threads = loadThreads();
  const activeId = getActiveThreadId();

  threadListEl.innerHTML = '';

  // sortera: senast uppdaterad först
  const sorted = [...threads].sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  for (const t of sorted) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thread-item' + (t.id === activeId ? ' active' : '');
    btn.textContent = t.title || 'Konversation';
    btn.addEventListener('click', () => {
      setActiveThreadId(t.id);
      renderThreadList();
      renderActiveThread();
    });
    threadListEl.appendChild(btn);
  }
}

function renderActiveThread() {
  const threads = loadThreads();
  const thread = getActiveThread(threads);

  chatLog.innerHTML = '';

  if (!thread) {
    addBubble('assistant', '❌ Ingen tråd vald.');
    return;
  }

  if (threadTitleEl) threadTitleEl.textContent = thread.title || 'Konversation';

  const msgs = Array.isArray(thread.messages) ? thread.messages : [];
  for (const m of msgs) {
    if (!m || !m.role) continue;
    addBubble(m.role, m.text || '');
  }
  scrollToBottom();
}

function updateThread(threadId, updaterFn) {
  const threads = loadThreads();
  const idx = threads.findIndex(t => t.id === threadId);
  if (idx === -1) return;

  const updated = updaterFn({ ...threads[idx] });
  threads[idx] = updated;
  saveThreads(threads);
}

function createNewThread() {
  const threads = loadThreads();
  const id = makeId();
  const thread = {
    id,
    title: 'Ny konversation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  threads.unshift(thread);
  saveThreads(threads);
  setActiveThreadId(id);
  renderThreadList();
  renderActiveThread();
  userEl.focus();
}

function deleteActiveThread() {
  const threads = loadThreads();
  const activeId = getActiveThreadId();
  if (!activeId) return;

  if (threads.length <= 1) {
    // minst en tråd måste finnas
    setStatus('Kan inte ta bort sista tråden.');
    setTimeout(() => setStatus(''), 1200);
    return;
  }

  const filtered = threads.filter(t => t.id !== activeId);
  saveThreads(filtered);
  setActiveThreadId(filtered[0].id);
  renderThreadList();
  renderActiveThread();
  setStatus('Tråd borttagen.');
  setTimeout(() => setStatus(''), 900);
}

async function sendMessage() {
  const systemPrompt = (localStorage.getItem(LS_SYSTEM_PROMPT_KEY) || '').trim();
  const userPrompt = (userEl.value || '').trim();

  if (!userPrompt) {
    setStatus('Skriv ett meddelande först.');
    return;
  }

  const activeId = getActiveThreadId();
  if (!activeId) {
    setStatus('Ingen tråd vald.');
    return;
  }

  setStatus('Skickar...');
  sendBtn.disabled = true;

  // UI direkt
  addBubble('user', userPrompt);

  // spara i tråd
  updateThread(activeId, (t) => {
    const msgs = Array.isArray(t.messages) ? t.messages : [];
    // sätt titel på första user-meddelandet
    if (!msgs.some(m => m.role === 'user')) {
      t.title = makeTitleFromText(userPrompt);
    }
    msgs.push({ role: 'user', text: userPrompt, at: new Date().toISOString() });
    t.messages = msgs;
    t.updatedAt = new Date().toISOString();
    return t;
  });

  renderThreadList();

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
      const msg = `❌ Fel: ${err}`;
      addBubble('assistant', msg);
      updateThread(activeId, (t) => {
        const msgs = Array.isArray(t.messages) ? t.messages : [];
        msgs.push({ role: 'assistant', text: msg, at: new Date().toISOString() });
        t.messages = msgs;
        t.updatedAt = new Date().toISOString();
        return t;
      });
      setStatus('Fel.');
      return;
    }

    const answer = json.answer || '(tomt svar)';
    addBubble('assistant', answer);

    updateThread(activeId, (t) => {
      const msgs = Array.isArray(t.messages) ? t.messages : [];
      msgs.push({ role: 'assistant', text: answer, at: new Date().toISOString() });
      t.messages = msgs;
      t.updatedAt = new Date().toISOString();
      return t;
    });

    renderThreadList();

    setStatus('Klart.');
    userEl.value = '';
    userEl.focus();
  } catch (e) {
    const msg = `❌ Nätverksfel: ${e?.message || e}`;
    addBubble('assistant', msg);
    updateThread(activeId, (t) => {
      const msgs = Array.isArray(t.messages) ? t.messages : [];
      msgs.push({ role: 'assistant', text: msg, at: new Date().toISOString() });
      t.messages = msgs;
      t.updatedAt = new Date().toISOString();
      return t;
    });
    setStatus('Nätverksfel.');
  } finally {
    sendBtn.disabled = false;
    setTimeout(() => setStatus(''), 1200);
    scrollToBottom();
  }
}

function init() {
  ensureDefaultThread();
  loadSystemPrompt();
  renderThreadList();
  renderActiveThread();

  if (newThreadBtn) newThreadBtn.addEventListener('click', createNewThread);
  if (deleteThreadBtn) deleteThreadBtn.addEventListener('click', deleteActiveThread);

  sendBtn.addEventListener('click', sendMessage);

  clearBtn.addEventListener('click', () => {
    // rensa bara aktiv tråd
    const activeId = getActiveThreadId();
    if (!activeId) return;

    updateThread(activeId, (t) => {
      t.messages = [];
      t.updatedAt = new Date().toISOString();
      // behåll titel
      return t;
    });

    renderActiveThread();
    renderThreadList();

    setStatus('Rensat (denna tråd).');
    setTimeout(() => setStatus(''), 900);
  });

  // Enter = skicka, Shift+Enter = ny rad
  userEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Om man ändrar inställningar i annan flik → uppdatera systemprompt
  window.addEventListener('storage', (e) => {
    if (e.key === LS_SYSTEM_PROMPT_KEY) loadSystemPrompt();
    if (e.key === LS_THREADS_KEY || e.key === LS_ACTIVE_THREAD_KEY) {
      renderThreadList();
      renderActiveThread();
    }
  });

  userEl.focus();
  scrollToBottom();
}

document.addEventListener('DOMContentLoaded', init);
