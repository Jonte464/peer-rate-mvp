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
 * type: 'success' | 'error' | 'info'
 * message: text
 * targetId (valfritt): id på elementet att uppdatera
 */
function showNotification(type, message, targetId) {
  const defaultTarget = el('customer-notice')
    ? 'customer-notice'
    : el('cust-notice')
      ? 'cust-notice'
      : 'notice';

  const id = targetId || defaultTarget;
  const box = el(id);
  if (!box) return;

  let cls = 'notice';
  if (type === 'success') cls = 'notice ok';
  else if (type === 'error') cls = 'notice err';
  else cls = 'notice info';

  box.className = cls;
  box.textContent = message || '';

  try {
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (_) {}

  _clearTimerFor(id);

  const ttl = type === 'success' ? 7000 : type === 'error' ? 9000 : 5000;
  _timers[id] = setTimeout(() => {
    box.className = 'notice';
    box.textContent = '';
    delete _timers[id];
  }, ttl);
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