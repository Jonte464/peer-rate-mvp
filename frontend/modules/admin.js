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

const adminAlertsSummary = el('admin-alerts-summary');
const adminAlertsTable = el('admin-alerts-table');
const adminAlertDetail = el('admin-alert-detail');

let adminCustomersCurrentPage = 1;
let adminCustomersPageSize = 50;
let adminReportsCache = [];
let adminAlertsCache = [];

// ---------------------------------------------------------
// Hjälpfunktion: vad händer när admin är inloggad?
// ---------------------------------------------------------
function onAdminLoggedIn() {
  if (!adminRoot) return;
  adminRoot.classList.remove('hidden');
  if (adminLoginCard) adminLoginCard.classList.add('hidden');

  loadAdminSummary();
  loadAdminRecentRatings();
  loadAdminSuspiciousDeals();
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
      showNotification(
        'error',
        'Fyll i admin-lösenord.',
        'admin-login-notice'
      );
      return;
    }
    showNotification('success', 'Loggar in…', 'admin-login-notice');
    try {
      const res = await api.adminLogin({ password: pwd });
      if (res && res.ok) {
        showNotification(
          'success',
          'Admin-inloggning lyckades.',
          'admin-login-notice'
        );
        localStorage.setItem('peerRateAdminKey', pwd);
        onAdminLoggedIn();
      } else {
        showNotification(
          'error',
          res?.error || 'Admin-inloggning misslyckades.',
          'admin-login-notice'
        );
      }
    } catch (err) {
      console.error('Admin login error:', err);
      showNotification(
        'error',
        'Nätverksfel vid admin-inloggning.',
        'admin-login-notice'
      );
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
  if (!storedKey) return;

  try {
    const res = await api.adminFetch('/api/admin/summary');
    if (res && res.ok) {
      onAdminLoggedIn();
    } else {
      localStorage.removeItem('peerRateAdminKey');
    }
  } catch (err) {
    console.error('Auto-admin-login error:', err);
  }
}

tryAutoAdminLogin();

// ---------------------------------------------------------
// Helpers
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

function formatDateTime(value) {
  try {
    const d = new Date(value || '');
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('sv-SE');
  } catch {
    return '';
  }
}

function shortText(value, max = 120) {
  const v = String(value || '');
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

function buildRaterDisplay(rating) {
  return (
    rating?.raterName ||
    rating?.raterEmail ||
    rating?.raterDisplay ||
    '–'
  );
}

function getSeverityLabel(ratingCount) {
  const n = Number(ratingCount || 0);
  if (n >= 5) return 'Hög risk';
  if (n >= 4) return 'Förhöjd risk';
  return 'Behöver granskas';
}

function renderAlertSummary(count) {
  if (!adminAlertsSummary) return;

  const n = Number(count || 0);
  if (n <= 0) {
    adminAlertsSummary.classList.add('hidden');
    adminAlertsSummary.textContent = '';
    return;
  }

  adminAlertsSummary.classList.remove('hidden');
  adminAlertsSummary.textContent =
    n === 1
      ? '1 misstänkt affär har flaggats eftersom samma verifierade deal har fler än 2 omdömen.'
      : `${n} misstänkta affärer har flaggats eftersom samma verifierade deal har fler än 2 omdömen.`;
}

async function deleteAdminRating(ratingId) {
  if (!ratingId) return;

  const ok = window.confirm(
    'Är du säker på att du vill radera det här omdömet? Detta kan inte ångras.'
  );
  if (!ok) return;

  try {
    const res = await api.adminFetch(
      `/api/admin/ratings/${encodeURIComponent(ratingId)}`,
      {
        method: 'DELETE',
      }
    );

    if (res && res.ok) {
      alert('Omdömet har raderats.');
      await Promise.all([
        loadAdminSummary(),
        loadAdminRecentRatings(),
        loadAdminSuspiciousDeals(),
      ]);
      return;
    }

    alert(res?.error || 'Kunde inte radera omdömet.');
  } catch (err) {
    console.error('delete rating error', err);
    alert('Fel vid radering av omdöme.');
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

      if (!rows.length) {
        adminRatingsTable.innerHTML =
          '<div class="tiny muted">Det finns inga omdömen ännu.</div>';
        return;
      }

      let html =
        '<table><thead><tr><th>Datum</th><th>Fått omdöme</th><th>Lämnat av</th><th>Betyg</th><th>Kommentar</th><th></th></tr></thead><tbody>';

      rows.forEach((r) => {
        html += `
          <tr data-rating-id="${escapeHtml(String(r.id || ''))}">
            <td>${escapeHtml(formatDateTime(r.createdAt))}</td>
            <td>${escapeHtml(r.ratedUser || r.subject || '')}</td>
            <td>${escapeHtml(buildRaterDisplay(r))}</td>
            <td>${escapeHtml(String(r.rating ?? r.score ?? ''))}</td>
            <td>${escapeHtml(shortText(r.comment || r.text || '', 120))}</td>
            <td>
              <button
                type="button"
                class="icon-btn danger delete-rating-btn"
                data-id="${escapeHtml(String(r.id || ''))}"
              >
                Ta bort
              </button>
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      adminRatingsTable.innerHTML = html;

      adminRatingsTable
        .querySelectorAll('.delete-rating-btn')
        .forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const id = btn.getAttribute('data-id');
            if (!id) return;

            btn.disabled = true;
            try {
              await deleteAdminRating(id);
            } finally {
              btn.disabled = false;
            }
          });
        });

      return;
    }

    adminRatingsTable.textContent = 'Kunde inte ladda senaste betyg.';
  } catch (err) {
    console.error('loadAdminRecentRatings error', err);
    adminRatingsTable.textContent = 'Fel vid hämtning.';
  }
}

// ---------------------------------------------------------
// Alerts – misstänkta deals med fler än 2 omdömen
// ---------------------------------------------------------
async function loadAdminSuspiciousDeals() {
  if (!adminAlertsTable) return;

  try {
    const res = await api.adminFetch('/api/admin/alerts/suspicious-deals');

    if (!res || res.ok !== true || !Array.isArray(res.alerts)) {
      renderAlertSummary(0);
      adminAlertsTable.textContent = 'Kunde inte ladda alerts.';
      if (adminAlertDetail) adminAlertDetail.innerHTML = '';
      return;
    }

    adminAlertsCache = res.alerts || [];
    renderAlertSummary(adminAlertsCache.length);

    if (!adminAlertsCache.length) {
      adminAlertsTable.innerHTML =
        '<div class="tiny muted">Inga misstänkta affärer hittades just nu.</div>';
      if (adminAlertDetail) adminAlertDetail.innerHTML = '';
      return;
    }

    let html =
      '<table><thead><tr><th>Plattform</th><th>Order / proofRef</th><th>Antal omdömen</th><th>Severity</th><th>Senast uppdaterad</th></tr></thead><tbody>';

    adminAlertsCache.forEach((alert, idx) => {
      html += `
        <tr data-index="${idx}" style="cursor:pointer;">
          <td>${escapeHtml(alert.platform || '')}</td>
          <td>${escapeHtml(alert.externalProofRef || '–')}</td>
          <td>${escapeHtml(String(alert.ratingCount || 0))}</td>
          <td><span class="severity-pill">${escapeHtml(getSeverityLabel(alert.ratingCount))}</span></td>
          <td>${escapeHtml(formatDateTime(alert.updatedAt))}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    adminAlertsTable.innerHTML = html;

    adminAlertsTable.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => {
        const idx = Number(tr.getAttribute('data-index') || '-1');
        if (idx < 0 || idx >= adminAlertsCache.length) return;
        renderSuspiciousDealDetail(adminAlertsCache[idx]);
      });
    });

    renderSuspiciousDealDetail(adminAlertsCache[0]);
  } catch (err) {
    console.error('loadAdminSuspiciousDeals error', err);
    renderAlertSummary(0);
    adminAlertsTable.textContent = 'Fel vid hämtning.';
    if (adminAlertDetail) adminAlertDetail.innerHTML = '';
  }
}

function renderSuspiciousDealDetail(alert) {
  if (!adminAlertDetail) return;
  if (!alert) {
    adminAlertDetail.innerHTML = '';
    return;
  }

  let html = '';
  html += `<div class="detail-card">`;
  html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">`;
  html += `<h3>Detaljer för misstänkt affär</h3>`;
  html += `<span class="severity-pill">${escapeHtml(getSeverityLabel(alert.ratingCount))}</span>`;
  html += `</div>`;

  html += `<div class="detail-grid">`;
  html += `<div class="detail-item"><strong>Plattform</strong><div>${escapeHtml(alert.platform || '–')}</div></div>`;
  html += `<div class="detail-item"><strong>Order / proofRef</strong><div>${escapeHtml(alert.externalProofRef || '–')}</div></div>`;
  html += `<div class="detail-item"><strong>Item ID</strong><div>${escapeHtml(alert.externalItemId || '–')}</div></div>`;
  html += `<div class="detail-item"><strong>Antal omdömen</strong><div>${escapeHtml(String(alert.ratingCount || 0))}</div></div>`;
  html += `<div class="detail-item"><strong>Titel</strong><div>${escapeHtml(alert.title || '–')}</div></div>`;
  html += `<div class="detail-item"><strong>Belopp</strong><div>${escapeHtml(alert.amountDisplay || '–')}</div></div>`;
  html += `<div class="detail-item"><strong>Deal ID</strong><div>${escapeHtml(alert.dealId || '–')}</div></div>`;
  html += `<div class="detail-item"><strong>Senast uppdaterad</strong><div>${escapeHtml(formatDateTime(alert.updatedAt))}</div></div>`;
  html += `</div>`;

  if (alert.externalPageUrl) {
    html += `<div class="tiny" style="margin-top:8px;"><strong>Källsida:</strong> <a href="${escapeHtml(alert.externalPageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(alert.externalPageUrl)}</a></div>`;
  }

  html += `<div style="margin-top:12px;"><strong>Omdömen kopplade till affären</strong></div>`;

  const ratings = Array.isArray(alert.ratings) ? alert.ratings : [];
  if (!ratings.length) {
    html += `<div class="tiny muted" style="margin-top:6px;">Inga omdömen kopplade till denna alert.</div>`;
  } else {
    html += `<table><thead><tr><th>Datum</th><th>Fått omdöme</th><th>Lämnat av</th><th>Betyg</th><th>Kommentar</th><th></th></tr></thead><tbody>`;
    ratings.forEach((r) => {
      html += `
        <tr>
          <td>${escapeHtml(formatDateTime(r.createdAt))}</td>
          <td>${escapeHtml(r.ratedUser || '–')}</td>
          <td>${escapeHtml(buildRaterDisplay(r))}</td>
          <td>${escapeHtml(String(r.score ?? r.rating ?? ''))}</td>
          <td>${escapeHtml(shortText(r.text || r.comment || '', 140))}</td>
          <td>
            <button
              type="button"
              class="icon-btn danger detail-delete-rating-btn"
              data-id="${escapeHtml(String(r.id || ''))}"
            >
              Ta bort
            </button>
          </td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
  }

  html += `<details style="margin-top:10px;">
    <summary class="tiny">Visa rådata för alert</summary>
    <pre class="tiny" style="white-space:pre-wrap;margin-top:4px;">${escapeHtml(JSON.stringify(alert, null, 2))}</pre>
  </details>`;

  html += `</div>`;
  adminAlertDetail.innerHTML = html;

  adminAlertDetail.querySelectorAll('.detail-delete-rating-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      btn.disabled = true;
      try {
        await deleteAdminRating(id);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ---------------------------------------------------------
// Senaste rapporter
// ---------------------------------------------------------
async function loadAdminRecentReports() {
  if (!adminReportsTable) return;
  try {
    const res = await api.adminFetch('/api/admin/reports/recent');
    if (res && res.ok && Array.isArray(res.reports)) {
      adminReportsCache = res.reports;
      const rows = res.reports;
      let html =
        '<table><thead><tr><th>Datum</th><th>Kund</th><th>Typ</th><th>Status</th></tr></thead><tbody>';
      rows.forEach((r, idx) => {
        const d = new Date(r.createdAt);
        const dateStr = isNaN(d.getTime())
          ? ''
          : d.toLocaleString('sv-SE');
        html += `<tr data-index="${idx}" style="cursor:pointer;"><td>${dateStr}</td><td>${escapeHtml(
          r.subjectRef || ''
        )}</td><td>${escapeHtml(r.reason || '')}</td><td>${escapeHtml(
          r.status || ''
        )}</td></tr>`;
      });
      html += '</tbody></table>';
      adminReportsTable.innerHTML = html;

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
    console.error('loadAdminRecentReports error:', err);
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
    const res = await api.adminFetch(
      `/api/admin/customers?limit=${adminCustomersPageSize}&page=${page}`
    );
    if (!res || !res.ok) {
      const serverMsg =
        res && res.error ? res.error : 'Kunde inte ladda kunder.';
      adminCustomersTable.innerHTML = `<div class="tiny err">${escapeHtml(
        String(serverMsg)
      )}</div>`;
      return;
    }

    const rows = Array.isArray(res.customers) ? res.customers : [];
    adminCustomersCurrentPage = Number(res.page || page || 1);
    adminCustomersPageSize = Number(
      res.pageSize || adminCustomersPageSize
    );
    const total = Number(res.total || 0);

    if (!rows.length) {
      adminCustomersTable.innerHTML =
        '<div class="tiny muted">Inga kunder hittades.</div>';
      return;
    }

    let html =
      '<table><thead><tr><th>Namn</th><th>E-post</th><th>subjectRef</th><th>Registrerat</th><th></th></tr></thead><tbody>';
    rows.forEach((c) => {
      const d = new Date(c.createdAt || c.registeredAt || '');
      const dateStr = isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('sv-SE');
      const displayName = c.fullName || c.name || '(namn saknas)';
      const key = c.subjectRef || c.id || c.email || '';
      const id = c.id;
      html += `
        <tr data-key="${escapeHtml(key)}" data-id="${escapeHtml(
        String(id)
      )}" style="cursor:pointer;">
          <td>${escapeHtml(displayName)}</td>
          <td>${escapeHtml(c.email || '')}</td>
          <td>${escapeHtml(c.subjectRef || '')}</td>
          <td>${dateStr}</td>
          <td>
            <button type="button" class="icon-btn danger delete-customer-btn" data-id="${escapeHtml(
              String(id)
            )}">
              Ta bort
            </button>
          </td>
        </tr>`;
    });
    html += '</tbody></table>';

    const totalPages = Math.max(
      1,
      Math.ceil(total / adminCustomersPageSize)
    );
    const prevDisabled = adminCustomersCurrentPage <= 1 ? 'disabled' : '';
    const nextDisabled =
      adminCustomersCurrentPage >= totalPages ? 'disabled' : '';
    html += `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
      <button id="cust-prev" ${prevDisabled} class="secondary" type="button">Föregående</button>
      <div class="tiny muted">Sida ${adminCustomersCurrentPage} av ${totalPages} — ${total} kunder</div>
      <button id="cust-next" ${nextDisabled} class="secondary" type="button">Nästa</button>
    </div>`;

    adminCustomersTable.innerHTML = html;

    adminCustomersTable.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', async () => {
        const key = tr.getAttribute('data-key');
        if (!key) return;
        try {
          const res = await api.adminFetch(
            `/api/admin/customer?q=${encodeURIComponent(key)}`
          );
          if (!res || !res.ok || !res.customer) {
            if (adminSearchResult)
              adminSearchResult.textContent =
                'Kunde inte hämta kunddetaljer.';
            return;
          }
          renderCustomerDetails(res.customer);
        } catch (err) {
          console.error('fetch customer details error', err);
          if (adminSearchResult)
            adminSearchResult.textContent =
              'Fel vid hämtning av kund.';
        }
      });
    });

    adminCustomersTable
      .querySelectorAll('.delete-customer-btn')
      .forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          if (!id) return;

          const ok = window.confirm(
            'Är du säker på att du vill radera den här kunden? Detta kan inte ångras.'
          );
          if (!ok) return;

          try {
            const res = await api.adminFetch(
              `/api/admin/customers/${encodeURIComponent(id)}`,
              {
                method: 'DELETE',
              }
            );
            if (res && res.ok) {
              alert('Kunden har raderats.');
              await Promise.all([
                loadAdminCustomers(1),
                loadAdminSummary(),
                loadAdminRecentRatings(),
                loadAdminSuspiciousDeals(),
              ]);
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

    const prevBtn = adminCustomersTable.querySelector('#cust-prev');
    const nextBtn = adminCustomersTable.querySelector('#cust-next');
    if (prevBtn)
      prevBtn.addEventListener('click', () =>
        loadAdminCustomers(
          Math.max(1, adminCustomersCurrentPage - 1)
        )
      );
    if (nextBtn)
      nextBtn.addEventListener('click', () =>
        loadAdminCustomers(
          Math.min(totalPages, adminCustomersCurrentPage + 1)
        )
      );
  } catch (err) {
    console.error('loadAdminCustomers error', err);
    adminCustomersTable.textContent = 'Fel vid hämtning.';
  }
}

// ---------------------------------------------------------
// Rendera kunddetaljer
// ---------------------------------------------------------
function renderCustomerDetails(c) {
  if (!adminSearchResult) return;
  let html = '';
  html += `<div><strong>${escapeHtml(
    c.fullName || '(namn saknas)'
  )}</strong></div>`;
  html += `<div class="tiny muted">E-post: ${escapeHtml(
    c.email || '–'
  )} | subjectRef: ${escapeHtml(
    c.subjectRef || '–'
  )} | personnummer: ${escapeHtml(c.personalNumber || '–')}</div>`;
  if (Array.isArray(c.ratings) && c.ratings.length) {
    html +=
      '<table><thead><tr><th>Datum</th><th>Betyg</th><th>Rater</th><th>Kommentar</th></tr></thead><tbody>';
    c.ratings.forEach((r) => {
      const d = new Date(r.createdAt);
      const dateStr = isNaN(d.getTime())
        ? ''
        : d.toLocaleString('sv-SE');
      html += `<tr><td>${dateStr}</td><td>${escapeHtml(
        String(r.score || r.rating || '')
      )}</td><td>${escapeHtml(
        r.raterName || r.raterEmail || ''
      )}</td><td>${escapeHtml(
        (r.text || r.comment || '').slice(0, 160)
      )}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  adminSearchResult.innerHTML = html;
}

// ---------------------------------------------------------
// Hjälp: äldre rapportbeskrivning
// ---------------------------------------------------------
function parseLegacyDescription(details) {
  if (!details) return null;

  let text = details;
  const result = {};

  const dateRe = /Datum:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i;
  const timeRe = /Tid:\s*([0-9]{1,2}:[0-9]{2})/i;
  const amountRe = /Belopp:\s*([0-9]+(?:[.,][0-9]+)?)/i;
  const linkRe = /Länk:\s*(\S+)/i;

  const dateMatch = details.match(dateRe);
  const timeMatch = details.match(timeRe);
  const amountMatch = details.match(amountRe);
  const linkMatch = details.match(linkRe);

  if (dateMatch) result.date = dateMatch[1];
  if (timeMatch) result.time = timeMatch[1];
  if (amountMatch) result.amount = amountMatch[1];
  if (linkMatch) result.link = linkMatch[1];

  text = text.replace(dateRe, '');
  text = text.replace(timeRe, '');
  text = text.replace(amountRe, '');
  text = text.replace(linkRe, '');
  text = text.replace(/\s+/g, ' ').trim();

  result.text = text || null;
  return result;
}

// ---------------------------------------------------------
// Rendera rapport-detaljer
// ---------------------------------------------------------
function renderReportDetails(r) {
  if (!adminReportDetail) return;

  const created = r.createdAt ? new Date(r.createdAt) : null;
  const createdStr =
    created && !isNaN(created.getTime())
      ? created.toLocaleString('sv-SE')
      : '';

  const occurred = r.occurredAt ? new Date(r.occurredAt) : null;
  let occurredStr =
    occurred && !isNaN(occurred.getTime())
      ? occurred.toLocaleString('sv-SE')
      : null;

  const legacy =
    r.details && typeof r.details === 'string'
      ? parseLegacyDescription(r.details)
      : null;

  if (!occurredStr && legacy && (legacy.date || legacy.time)) {
    const parts = [];
    if (legacy.date) parts.push(legacy.date);
    if (legacy.time) parts.push(legacy.time);
    occurredStr = parts.join(' ');
  }

  let amountDisplay = r.amount;
  if ((amountDisplay === null || amountDisplay === undefined) && legacy && legacy.amount) {
    amountDisplay = legacy.amount;
  }

  const counterpartyLink = r.counterpartyLink || (legacy && legacy.link) || null;

  let descriptionText = r.details;
  if (legacy && legacy.text !== null) {
    descriptionText = legacy.text;
  }

  let html = '';
  html += `<h3 style="margin:0 0 4px;font-size:14px;">Detaljer för rapport</h3>`;
  html += `<div class="tiny muted" style="margin-bottom:8px;">Skapad: ${escapeHtml(
    createdStr
  )}</div>`;

  if (occurredStr) {
    html += `<div class="tiny"><strong>Tidpunkt för händelsen:</strong> ${escapeHtml(
      occurredStr
    )}</div>`;
  }

  html += `<div class="tiny"><strong>Kund (subjectRef):</strong> ${escapeHtml(
    r.subjectRef || '–'
  )}</div>`;
  html += `<div class="tiny"><strong>Namn:</strong> ${escapeHtml(
    r.fullName || '–'
  )}</div>`;
  html += `<div class="tiny"><strong>Typ av problem:</strong> ${escapeHtml(
    r.reason || '–'
  )}</div>`;
  html += `<div class="tiny"><strong>Status:</strong> ${escapeHtml(
    r.status || '–'
  )}</div>`;

  if (amountDisplay !== null && amountDisplay !== undefined) {
    html += `<div class="tiny"><strong>Belopp:</strong> ${escapeHtml(
      String(amountDisplay)
    )} ${escapeHtml(r.currency || 'SEK')}</div>`;
  }

  if (counterpartyLink) {
    html += `<div class="tiny"><strong>Motpart/annonslänk:</strong> <a href="${escapeHtml(
      counterpartyLink
    )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
      counterpartyLink
    )}</a></div>`;
  }

  if (descriptionText) {
    html += `<div class="tiny" style="margin-top:6px;"><strong>Beskrivning:</strong><br/>${escapeHtml(
      descriptionText
    )}</div>`;
  }

  if (r.evidenceUrl) {
    html += `<div class="tiny" style="margin-top:6px;"><strong>Bevislänk:</strong> <a href="${escapeHtml(
      r.evidenceUrl
    )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
      r.evidenceUrl
    )}</a></div>`;
  }

  if (r.reporterConsent !== null && r.reporterConsent !== undefined) {
    html += `<div class="tiny" style="margin-top:6px;"><strong>Reporter har intygat uppgifterna:</strong> ${
      r.reporterConsent ? 'Ja' : 'Nej'
    }</div>`;
  }

  if (r.verificationId) {
    html += `<div class="tiny"><strong>Verifierings-ID:</strong> ${escapeHtml(
      r.verificationId
    )}</div>`;
  }

  html += `<details style="margin-top:8px;">
    <summary class="tiny">Visa rådata (alla fält från API:t)</summary>
    <pre class="tiny" style="white-space:pre-wrap;margin-top:4px;">${escapeHtml(
      JSON.stringify(r, null, 2)
    )}</pre>
  </details>`;

  adminReportDetail.innerHTML = html;
}

// ---------------------------------------------------------
// HTML escaper
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
      if (adminSearchResult)
        adminSearchResult.textContent = 'Fyll i något att söka på.';
      return;
    }
    if (adminSearchResult) adminSearchResult.textContent = 'Söker…';
    try {
      const res = await api.adminFetch(
        `/api/admin/customer?q=${encodeURIComponent(q)}`
      );
      if (!res || !res.ok || !res.customer) {
        if (adminSearchResult)
          adminSearchResult.textContent =
            'Ingen kund hittades för sökningen.';
        return;
      }
      renderCustomerDetails(res.customer);
    } catch (err) {
      console.error('admin search error', err);
      if (adminSearchResult)
        adminSearchResult.textContent = 'Fel vid sökning.';
    }
  });
}

export { adminLoginForm, adminLogoutBtn };