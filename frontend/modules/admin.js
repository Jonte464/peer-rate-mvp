// admin.js - Hanterar admin-funktioner

import api from './api.js';
import { el, showNotification } from './utils.js';

const adminLoginForm = el('admin-login-form');
const adminPasswordInput = el('admin-password');
const adminLoginNotice = el('admin-login-notice');
const adminRoot = el('admin-root');
const adminLogoutBtn = el('admin-logout-btn');
const adminStatCustomers = el('stat-customers');
const adminStatRatings = el('stat-ratings');
const adminStatReports = el('stat-reports');
const adminSearchForm = el('admin-search-form');
const adminSearchInput = el('admin-search-input');
const adminSearchResult = el('admin-search-result');
const adminRatingsTable = el('admin-ratings-table');
const adminReportsTable = el('admin-reports-table');

if (adminLoginForm && adminPasswordInput) {
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = adminPasswordInput.value.trim();
    if (!pwd) {
      showNotification('error', 'Fyll i admin-lösenord.', 'admin-login-notice');
      return;
    }
    showNotification('success', 'Loggar in…', 'admin-login-notice');
    try {
      const res = await api.adminLogin({ password: pwd });
      if (res && res.ok) {
        showNotification('success', 'Admin-inloggning lyckades.', 'admin-login-notice');
        localStorage.setItem('peerRateAdminKey', pwd);
        adminRoot.classList.remove('hidden');
        // Ladda initialt admin-innehåll
        loadAdminSummary();
        loadAdminRecentRatings();
        loadAdminRecentReports();
      } else {
        showNotification('error', res?.error || 'Admin-inloggning misslyckades.', 'admin-login-notice');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      showNotification('error', 'Nätverksfel vid admin-inloggning.', 'admin-login-notice');
    }
  });
}

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('peerRateAdminKey');
    adminRoot.classList.add('hidden');
  });
}

// Ladda admin-översikt (totalsiffror)
async function loadAdminSummary() {
  try {
    const res = await api.adminFetch('/api/admin/summary');
    if (res && res.ok && res.counts) {
      if (adminStatCustomers) adminStatCustomers.textContent = res.counts.customers ?? '–';
      if (adminStatRatings) adminStatRatings.textContent = res.counts.ratings ?? '–';
      if (adminStatReports) adminStatReports.textContent = res.counts.reports ?? '–';
    } else {
      console.warn('loadAdminSummary failed', res);
    }
  } catch (err) {
    console.error('loadAdminSummary error', err);
  }
}

// Hämta senaste ratings (enkel rendering)
async function loadAdminRecentRatings() {
  if (!adminRatingsTable) return;
  try {
    const res = await api.adminFetch('/api/admin/ratings/recent');
    if (res && res.ok && Array.isArray(res.ratings)) {
      const rows = res.ratings;
      let html = '<table><thead><tr><th>Datum</th><th>Kund</th><th>Betyg</th><th>Kommentar</th></tr></thead><tbody>';
      rows.forEach((r) => {
        const d = new Date(r.createdAt);
        const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
        html += `<tr><td>${dateStr}</td><td>${r.subject}</td><td>${r.rating}</td><td>${(r.comment||'').slice(0,120)}</td></tr>`;
      });
      html += '</tbody></table>';
      adminRatingsTable.innerHTML = html;
    } else {
      adminRatingsTable.textContent = 'Kunde inte ladda senaste betyg.';
    }
  } catch (err) {
    console.error('loadAdminRecentRatings error', err);
    adminRatingsTable.textContent = 'Fel vid hämtning.';
  }
}

// Hämta senaste rapporter (enkel rendering)
async function loadAdminRecentReports() {
  if (!adminReportsTable) return;
  try {
    const res = await api.adminFetch('/api/admin/reports/recent');
    if (res && res.ok && Array.isArray(res.reports)) {
      const rows = res.reports;
      let html = '<table><thead><tr><th>Datum</th><th>Kund</th><th>Reason</th><th>Status</th></tr></thead><tbody>';
      rows.forEach((r) => {
        const d = new Date(r.createdAt);
        const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
        html += `<tr><td>${dateStr}</td><td>${r.subjectRef||''}</td><td>${r.reason}</td><td>${r.status||''}</td></tr>`;
      });
      html += '</tbody></table>';
      adminReportsTable.innerHTML = html;
    } else {
      adminReportsTable.textContent = 'Kunde inte ladda senaste rapporter.';
    }
  } catch (err) {
    console.error('loadAdminRecentReports error', err);
    adminReportsTable.textContent = 'Fel vid hämtning.';
  }
}

// Hantera admin-sök
if (adminSearchForm && adminSearchInput) {
  adminSearchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = adminSearchInput.value.trim();
    if (!q) {
      if (adminSearchResult) adminSearchResult.textContent = 'Fyll i något att söka på.';
      return;
    }
    if (adminSearchResult) adminSearchResult.textContent = 'Söker…';
    try {
      const res = await api.adminFetch(`/api/admin/customer?q=${encodeURIComponent(q)}`);
      if (!res || !res.ok || !res.customer) {
        if (adminSearchResult) adminSearchResult.textContent = 'Ingen kund hittades för sökningen.';
        return;
      }
      const c = res.customer;
      let html = '';
      html += `<div><strong>${c.fullName || '(namn saknas)'}</strong></div>`;
      html += `<div class="tiny muted">E-post: ${c.email || '–'} | subjectRef: ${c.subjectRef || '–'} | personnummer: ${c.personalNumber || '–'}</div>`;
      if (Array.isArray(c.ratings) && c.ratings.length) {
        html += '<table><thead><tr><th>Datum</th><th>Betyg</th><th>Rater</th><th>Kommentar</th></tr></thead><tbody>';
        c.ratings.forEach((r) => {
          const d = new Date(r.createdAt);
          const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
          html += `<tr><td>${dateStr}</td><td>${r.score}</td><td>${r.raterName||''}</td><td>${(r.text||'').slice(0,160)}</td></tr>`;
        });
        html += '</tbody></table>';
      }
      adminSearchResult.innerHTML = html;
    } catch (err) {
      console.error('admin search error', err);
      if (adminSearchResult) adminSearchResult.textContent = 'Fel vid sökning.';
    }
  });
}

export { adminLoginForm, adminLogoutBtn };