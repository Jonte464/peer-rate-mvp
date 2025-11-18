// utils.js - Hjälpfunktioner

function el(id) {
  return document.getElementById(id);
}

function showNotice(ok, msg) {
  const box = el('notice');
  if (!box) return;
  box.className = 'notice ' + (ok ? 'ok' : 'err');
  box.textContent = msg;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    box.className = 'notice';
    box.textContent = '';
  }, 6000);
}

function clearNotice() {
  const box = el('notice');
  if (!box) return;
  clearTimeout(noticeTimer);
  box.className = 'notice';
  box.textContent = '';
}

export { el, showNotice, clearNotice };