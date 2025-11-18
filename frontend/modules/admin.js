// admin.js - Hanterar admin-funktioner

import api from './api.js';
import { el, showNotice } from './utils.js';

const adminLoginForm = el('admin-login-form');
const adminPasswordInput = el('admin-password');
const adminLoginNotice = el('admin-login-notice');
const adminRoot = el('admin-root');
const adminLogoutBtn = el('admin-logout-btn');

if (adminLoginForm && adminPasswordInput) {
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = adminPasswordInput.value.trim();
    if (!pwd) {
      showNotice(false, 'Fyll i admin-lösenord.');
      return;
    }
    showNotice(true, 'Loggar in…');
    try {
      const res = await api.login({ password: pwd });
      if (res && res.ok) {
        showNotice(true, 'Admin-inloggning lyckades.');
        localStorage.setItem('peerRateAdminKey', pwd);
        adminRoot.classList.remove('hidden');
      } else {
        showNotice(false, res?.error || 'Admin-inloggning misslyckades.');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      showNotice(false, 'Nätverksfel vid admin-inloggning.');
    }
  });
}

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('peerRateAdminKey');
    adminRoot.classList.add('hidden');
  });
}

export { adminLoginForm, adminLogoutBtn };