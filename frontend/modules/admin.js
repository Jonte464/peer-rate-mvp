// admin.js - Hanterar admin-funktioner

import api from './api.js';
import { el, showNotification } from './utils.js';

const adminLoginCard = el('admin-login-card');
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

const adminCustomersTable = el('admin-customers-table');
const adminRatingsTable = el('admin-ratings-table');
const adminReportsTable = el('admin-reports-table');
const adminReportDetail = el('admin-report-detail');

let adminCustomersCurrentPage = 1;
let adminCustomersPageSize = 50;
let adminReportsCache = [];

// ---------------------------------------------------------
// Hjälpfunktion: vad händer när admin är inloggad?
// (används både vid vanlig login och vid auto-login på reload/F5)
// ---------------------------------------------------------
function onAdminLoggedIn() {
  if (!adminRoot) return;
  adminRoot.classList.remove('hidden');
  if (adminLoginCard) adminLoginCard.classList.add('hidden');

  // Ladda allt innehåll
  loadAdminSummary();
  loadAdminRecentRatings();
  loadAdminRecentReports();
  loadAdminCustomers();
}

// ---------------------------------------------------------
// Admin-login
// ---------------------------------------------------------
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
        // Spara nyckeln i localStorage så att F5 inte loggar ut
        localStorage.setItem('peerRateAdminKey', pwd);
        onAdminLoggedIn();
      } else {
        showNotification('error', res?.error || 'Admin-inloggning misslyckades.', 'admin-login-notice');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      showNotification('error', 'Nätverksfel vid admin-inloggning.', 'admin-login-notice');
    }
  });
}

// ---------------------------------------------------------
// Admin-logout
// ---------------------------------------------------------
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('peerRateAdminKey');
    if (adminRoot) adminRoot.classList.add('hidden');
    if (adminLoginCard) adminLoginCard.classList.remove('hidden');
  });
}

// ---------------------------------------------------------
// Auto-login vid sidladdning (F5)
// ---------------------------------------------------------
async function tryAutoAdminLogin() {
  const storedKey = localStorage.getItem('peerRateAdminKey');
  if (!storedKey) return; // Ingen sparad nyckel

  try {
    // Testa att hämta summary – funkar det så är nyckeln giltig
    const res = await api.adminFetch('/api/admin/summary');
    if (res && res.ok) {
      onAdminLoggedIn();
    } else {
      // Nyckeln funkar inte längre – ta bort den
      localStorage.removeItem('peerRateAdminKey');
    }
  } catch (err) {
    console.error('Auto-admin-login error:', err);
  }
}

// Kör auto-login direkt när modulen lästs in
tryAutoAdminLogin();

// ---------------------------------------------------------
// Ladda admin-översikt (totalsiffror)
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// Senaste betyg
// ---------------------------------------------------------
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
        html += `<tr><td>${dateStr}</td><td>${escapeHtml(r.subject)}</td><td>${escapeHtml(String(r.rating))}</td><td>${escapeHtml((r.comment || '').slice(0, 120))}</td></tr>`;
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

// ---------------------------------------------------------
// Senaste rapporter (med klickbar detaljvy)
// ---------------------------------------------------------
async function loadAdminRecentReports() {
  if (!adminReportsTable) return;
  try {
    const res = await api.adminFetch('/api/admin/reports/recent');
    if (res && res.ok && Array.isArray(res.reports)) {
      adminReportsCache = res.reports;
      const rows = res.reports;
      let html = '<table><thead><tr><th>Datum</th><th>Kund</th><th>Typ</th><th>Status</th></tr></thead><tbody>';
      rows.forEach((r, idx) => {
        const d = new Date(r.createdAt);
        const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
        html += `<tr data-index="${idx}" style="cursor:pointer;"><td>${dateStr}</td><td>${escapeHtml(r.subjectRef || '')}</td><td>${escapeHtml(r.reason || '')}</td><td>${escapeHtml(r.status || '')}</td></tr>`;
      });
      html += '</tbody></table>';
      adminReportsTable.innerHTML = html;

      // Klick på rad -> visa alla detaljer om rapporten
      adminReportsTable.querySelectorAll('tbody tr').forEach((tr) => {
        tr.addEventListener('click', () => {
          const idx = Number(tr.getAttribute('data-index') || '-1');
          if (idx < 0 || idx >= adminReportsCache.length) return;
          const report = adminReportsCache[idx];
          renderReportDetails(report);
        });
      });
    } else {
      adminReportsTable.textContent = 'Kunde inte ladda senaste rapporter.';
    }
  } catch (err) {
    console.error('loadAdminRecentReports error', err);
    adminReportsTable.textContent = 'Fel vid hämtning.';
  }
}

// ---------------------------------------------------------
// Kunder – lista + pagination + radera-knapp
// ---------------------------------------------------------
async function loadAdminCustomers(page = adminCustomersCurrentPage) {
  if (!adminCustomersTable) return;
  adminCustomersTable.textContent = 'Laddar…';
  try {
    const res = await api.adminFetch(`/api/admin/customers?limit=${adminCustomersPageSize}&page=${page}`);
    if (!res || !res.ok) {
      const serverMsg = res && res.error ? res.error : 'Kunde inte ladda kunder.';
      adminCustomersTable.innerHTML = `<div class="tiny err">${escapeHtml(String(serverMsg))}</div>`;
      return;
    }

    const rows = Array.isArray(res.customers) ? res.customers : [];
    adminCustomersCurrentPage = Number(res.page || page || 1);
    adminCustomersPageSize = Number(res.pageSize || adminCustomersPageSize);
    const total = Number(res.total || 0);

    if (!rows.length) {
      adminCustomersTable.innerHTML = '<div class="tiny muted">Inga kunder hittades.</div>';
      return;
    }

    let html = '<table><thead><tr><th>Namn</th><th>E-post</th><th>subjectRef</th><th>Registrerat</th><th></th></tr></thead><tbody>';
    rows.forEach((c) => {
      const d = new Date(c.createdAt || c.registeredAt || '');
      const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE');
      const displayName = c.fullName || c.name || '(namn saknas)';
      const key = c.subjectRef || c.id || c.email || '';
      const id = c.id;
      html += `
        <tr data-key="${escapeHtml(key)}" data-id="${escapeHtml(String(id))}" style="cursor:pointer;">
          <td>${escapeHtml(displayName)}</td>
          <td>${escapeHtml(c.email || '')}</td>
          <td>${escapeHtml(c.subjectRef || '')}</td>
          <td>${dateStr}</td>
          <td>
            <button type="button" class="icon-btn danger delete-customer-btn" data-id="${escapeHtml(String(id))}">
              Ta bort
            </button>
          </td>
        </tr>`;
    });
    html += '</tbody></table>';

    // Pagination controls
    const totalPages = Math.max(1, Math.ceil(total / adminCustomersPageSize));
    const prevDisabled = adminCustomersCurrentPage <= 1 ? 'disabled' : '';
    const nextDisabled = adminCustomersCurrentPage >= totalPages ? 'disabled' : '';
    html += `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
      <button id="cust-prev" ${prevDisabled} class="secondary" type="button">Föregående</button>
      <div class="tiny muted">Sida ${adminCustomersCurrentPage} av ${totalPages} — ${total} kunder</div>
      <button id="cust-next" ${nextDisabled} class="secondary" type="button">Nästa</button>
    </div>`;

    adminCustomersTable.innerHTML = html;

    // Klick på rad -> hämta kunddetaljer
    adminCustomersTable.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', async () => {
        const key = tr.getAttribute('data-key');
        if (!key) return;
        try {
          const res = await api.adminFetch(`/api/admin/customer?q=${encodeURIComponent(key)}`);
          if (!res || !res.ok || !res.customer) {
            if (adminSearchResult) adminSearchResult.textContent = 'Kunde inte hämta kunddetaljer.';
            return;
          }
          renderCustomerDetails(res.customer);
        } catch (err) {
          console.error('fetch customer details error', err);
          if (adminSearchResult) adminSearchResult.textContent = 'Fel vid hämtning av kund.';
        }
      });
    });

    // Klick på radera-knappar (stoppar bubbla så att raden inte triggar detaljvisning)
    adminCustomersTable.querySelectorAll('.delete-customer-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Viktigt: klicka inte raden samtidigt
        const id = btn.getAttribute('data-id');
        if (!id) return;

        const ok = window.confirm('Är du säker på att du vill radera den här kunden? Detta kan inte ångras.');
        if (!ok) return;

        try {
          const res = await api.adminFetch(`/api/admin/customers/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          if (res && res.ok) {
            alert('Kunden har raderats.');
            // Ladda om kundlistan (börjar om från första sidan)
            loadAdminCustomers(1);
            if (adminSearchResult) adminSearchResult.textContent = '';
          } else {
            alert(res?.error || 'Kunde inte radera kunden.');
          }
        } catch (err) {
          console.error('delete customer error', err);
          alert('Fel vid radering av kund.');
        }
      });
    });

    // Pagination button handlers
    const prevBtn = adminCustomersTable.querySelector('#cust-prev');
    const nextBtn = adminCustomersTable.querySelector('#cust-next');
    if (prevBtn) prevBtn.addEventListener('click', () => loadAdminCustomers(Math.max(1, adminCustomersCurrentPage - 1)));
    if (nextBtn) nextBtn.addEventListener('click', () => loadAdminCustomers(Math.min(totalPages, adminCustomersCurrentPage + 1)));
  } catch (err) {
    console.error('loadAdminCustomers error', err);
    adminCustomersTable.textContent = 'Fel vid hämtning.';
  }
}

// ---------------------------------------------------------
// Rendera kunddetaljer i samma area som sökresultatet
// ---------------------------------------------------------
function renderCustomerDetails(c) {
  if (!adminSearchResult) return;
  let html = '';
  html += `<div><strong>${escapeHtml(c.fullName || '(namn saknas)')}</strong></div>`;
  html += `<div class="tiny muted">E-post: ${escapeHtml(c.email || '–')} | subjectRef: ${escapeHtml(c.subjectRef || '–')} | personnummer: ${escapeHtml(c.personalNumber || '–')}</div>`;
  if (Array.isArray(c.ratings) && c.ratings.length) {
    html += '<table><thead><tr><th>Datum</th><th>Betyg</th><th>Rater</th><th>Kommentar</th></tr></thead><tbody>';
    c.ratings.forEach((r) => {
      const d = new Date(r.createdAt);
      const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
      html += `<tr><td>${dateStr}</td><td>${escapeHtml(String(r.score || r.rating || ''))}</td><td>${escapeHtml(r.raterName || '')}</td><td>${escapeHtml((r.text || r.comment || '').slice(0, 160))}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  adminSearchResult.innerHTML = html;
}

// ---------------------------------------------------------
// Rendera rapport-detaljer (klick från listan "Senaste rapporter")
// ---------------------------------------------------------
function renderReportDetails(r) {
  if (!adminReportDetail) return;

  const d = new Date(r.createdAt);
  const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');

  let html = '';
  html += `<h3 style="margin:0 0 4px;font-size:14px;">Detaljer för rapport</h3>`;
  html += `<div class="tiny muted" style="margin-bottom:8px;">Skapad: ${escapeHtml(dateStr)}</div>`;

  html += `<div class="tiny"><strong>Kund (subjectRef):</strong> ${escapeHtml(r.subjectRef || '–')}</div>`;
  html += `<div class="tiny"><strong>Typ av problem:</strong> ${escapeHtml(r.reason || '–')}</div>`;
  html += `<div class="tiny"><strong>Status:</strong> ${escapeHtml(r.status || '–')}</div>`;

  if (r.amountSek != null) {
    html += `<div class="tiny"><strong>Belopp (SEK):</strong> ${escapeHtml(String(r.amountSek))}</div>`;
  }
  if (r.counterpartyLink) {
    html += `<div class="tiny"><strong>Motpart/annonslänk:</strong> <a href="${escapeHtml(r.counterpartyLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.counterpartyLink)}</a></div>`;
  }
  if (r.description) {
    html += `<div class="tiny" style="margin-top:6px;"><strong>Beskrivning:</strong><br/>${escapeHtml(r.description)}</div>`;
  }
  if (r.evidenceLink) {
    html += `<div class="tiny" style="margin-top:6px;"><strong>Bevislänk:</strong> <a href="${escapeHtml(r.evidenceLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.evidenceLink)}</a></div>`;
  }

  // Visa alltid "rådata" så att du ser ALLT som finns i objektet,
  // även fält jag inte känner till.
  html += `<details style="margin-top:8px;">
    <summary class="tiny">Visa rådata (alla fält)</summary>
    <pre class="tiny" style="white-space:pre-wrap;margin-top:4px;">${escapeHtml(JSON.stringify(r, null, 2))}</pre>
  </details>`;

  adminReportDetail.innerHTML = html;
}

// ---------------------------------------------------------
// basic HTML escaper
// ---------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (s) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[s];
  });
}

// ---------------------------------------------------------
// Admin-sök
// ---------------------------------------------------------
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
      renderCustomerDetails(res.customer);
    } catch (err) {
      console.error('admin search error', err);
      if (adminSearchResult) adminSearchResult.textContent = 'Fel vid sökning.';
    }
  });
}

export { adminLoginForm, adminLogoutBtn };
