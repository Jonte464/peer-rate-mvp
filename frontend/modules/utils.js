// utils.js - Hjälpfunktioner

function el(id) {
  return document.getElementById(id);
}

// Hantera flera notis-timers (per element id)
const _timers = {};

function _clearTimerFor(id) {
  if (_timers[id]) {
    clearTimeout(_timers[id]);
    delete _timers[id];
  }
}

/**
 * Visa en notis i ett element med klass `notice`.
 * type: 'success' eller 'error'
 * message: text
 * targetId (valfritt): id på elementet att uppdatera (standard 'cust-notice' om finns, annars 'notice')
 */
function showNotification(type, message, targetId) {
  const defaultTarget = el('cust-notice') ? 'cust-notice' : 'notice';
  const id = targetId || defaultTarget;
  const box = el(id);
  if (!box) return;
  const cls = type === 'success' ? 'notice ok' : 'notice err';
  box.className = cls;
  box.textContent = message;
  _clearTimerFor(id);
  _timers[id] = setTimeout(() => {
    box.className = 'notice';
    box.textContent = '';
    delete _timers[id];
  }, 7000);
}

/** Bakåtkompatibla wrappers */
function showNotice(ok, msg) {
  showNotification(ok ? 'success' : 'error', msg, 'notice');
}

function clearNotice() {
  const box = el('notice');
  if (!box) return;
  _clearTimerFor('notice');
  box.className = 'notice';
  box.textContent = '';
}

export { el, showNotification, showNotice, clearNotice };