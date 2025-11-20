// =====================================================
// api.js – stabil version med datumformat + adressstöd
// =====================================================

// --- Helpers -----------------------------------------------------

function getAuthToken() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return (
      localStorage.getItem('peerRateToken') ||
      localStorage.getItem('token') ||
      null
    );
  } catch {
    return null;
  }
}

function buildAuthHeaders(baseHeaders = {}) {
  const headers = { ...baseHeaders };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// Format YYYY-MM-DD istället för ISO
function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return dateStr.split('T')[0]; // "2025-11-20T11:58:41Z" → "2025-11-20"
  } catch {
    return dateStr;
  }
}

// --- API ---------------------------------------------------------

const api = {
  createRating: (payload) => {
    return fetch('/api/ratings', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
      credentials: 'include'
    }).then(async (r) => {
      const raw = await r.text();
      try { return JSON.parse(raw); }
      catch { return { ok: r.ok, status: r.status, raw }; }
    });
  },

  createCustomer: (payload) => {
    return fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const raw = await r.text();
      try { return JSON.parse(raw); }
      catch { return { ok: r.ok, status: r.status, raw }; }
    });
  },

  login: (payload) => {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    }).then(async (r) => {
      const raw = await r.text();
      try {
        const json = JSON.parse(raw);
        if (json.token) {
          try { localStorage.setItem('peerRateToken', json.token); } catch {}
        }
        return json;
      } catch {
        return { ok: r.ok, status: r.status, raw };
      }
    });
  },

  adminLogin: (payload) => {
    return fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const raw = await r.text();
      try { return JSON.parse(raw); }
      catch { return { ok: r.ok, status: r.status, raw }; }
    });
  },

  adminFetch: (path, opts = {}) => {
    const key =
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('peerRateAdminKey')) ||
      '';
    const headers = Object.assign(
      {},
      opts.headers || {},
      key ? { 'x-admin-key': key } : {}
    );

    return fetch(path, { ...opts, headers }).then(async (r) => {
      const raw = await r.text();
      try { return JSON.parse(raw); }
      catch { return { ok: r.ok, status: r.status, raw }; }
    });
  },

  searchCustomers: (q) => {
    return fetch(`/api/customers?q=${encodeURIComponent(q)}`, {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    }).then(async (r) => {
      const raw = await r.text();
      try { return JSON.parse(raw); }
      catch { return { ok: r.ok, status: r.status, raw }; }
    });
  },

  _clientGet: async (path) => {
    try {
      const res = await fetch(path, {
        method: 'GET',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
      });

      const text = await res.text();
      try { return JSON.parse(text); }
      catch { return { ok: res.ok, status: res.status, raw: text }; }
    } catch (err) {
      console.error('api._clientGet error', err);
      return null;
    }
  },

  getCurrentCustomer: async () => {
    const endpoints = ['/api/customers/me', '/api/auth/me', '/api/profile/me'];

    for (const ep of endpoints) {
      try {
        const json = await api._clientGet(ep);
        if (!json) continue;

        if (json.ok && json.customer) return json.customer;
        if (json.customer) return json.customer;

        if (json.id && (json.email || json.subjectRef)) return json;
      } catch {}
    }

    try {
      const raw = localStorage.getItem('peerRateUser');
      if (!raw) return null;
      const cached = JSON.parse(raw);

      const q = cached.email || cached.subjectRef || cached.id || null;
      if (!q) return cached;

      const found = await api.searchCustomers(q);
      if (found?.ok && Array.isArray(found.customers) && found.customers.length)
        return found.customers[0];

      return cached;
    } catch {
      return null;
    }
  },

    // ---------------------- EXTERN DATA ---------------------------
  getExternalDataForCurrentCustomer: async () => {
    try {
      const current = await api.getCurrentCustomer();
      const email = current?.email || current?.subjectRef;
      if (!email) return null;

      const path = `/api/customers/external-data?email=${encodeURIComponent(email)}`;
      const json = await api._clientGet(path);
      if (!json || json.ok === false) return json; // kan vara null eller { ok:false, error:... }

      return {
        ok: true,
        vehicles: json.vehiclesCount ?? json.vehicles ?? null,
        properties: json.propertiesCount ?? json.properties ?? null,
        lastUpdated: formatDate(json.lastUpdated),
        validatedAddress: json.validatedAddress ?? null,
        addressStatus: json.addressStatus ?? null,
      };
    } catch (err) {
      console.error('getExternalDataForCurrentCustomer error', err);
      return null;
    }
  },

  // Hämta extern data för en specifik profil (t.ex. när du tittar på din frus profil)
  getExternalDataForEmail: async (emailOrSubject) => {
    try {
      if (!emailOrSubject) return null;

      const path = `/api/customers/external-data?email=${encodeURIComponent(emailOrSubject)}`;
      const json = await api._clientGet(path);
      if (!json) return null;

      return {
        ok: json.ok ?? true,
        vehicles: json.vehiclesCount ?? json.vehicles ?? 0,
        properties: json.propertiesCount ?? json.properties ?? 0,
        lastUpdated: formatDate(json.lastUpdated),
        validatedAddress: json.validatedAddress ?? '-',
        addressStatus: json.addressStatus ?? '-'
      };
    } catch (err) {
      console.error('getExternalDataForEmail error', err);
      return null;
    }
  },

  // ---------------------- MITT OMDÖME ---------------------------
  getMyRating: async () => {
    try {
      const current = await api.getCurrentCustomer();
      const subject = current?.subjectRef || current?.email;
      if (!subject) return null;

      const avgP = fetch(`/api/ratings/average?subject=${encodeURIComponent(subject)}`)
        .then(r => r.json().catch(() => null));

      const listP = fetch(`/api/ratings?subject=${encodeURIComponent(subject)}`)
        .then(r => r.json().catch(() => null));

      const [avg, list] = await Promise.all([avgP, listP]);

      return {
        average: avg?.average ?? null,
        count: avg?.count ?? 0,
        ratings: list?.ratings ?? []
      };
    } catch (err) {
      console.error('getMyRating error', err);
      return null;
    }
  },
};

export default api;
