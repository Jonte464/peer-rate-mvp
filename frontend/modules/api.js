// api.js - Hanterar API-anrop till backend

const api = {
  createRating: (payload) => {
    return fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const raw = await r.text();
      try {
        return JSON.parse(raw);
      } catch {
        console.warn('Non-JSON response (ratings):', raw);
        return { ok: r.ok, status: r.status, raw };
      }
    });
  },
  createCustomer: (payload) => {
    return fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const raw = await r.text();
      try {
        return JSON.parse(raw);
      } catch {
        console.warn('Non-JSON response (customers):', raw);
        return { ok: r.ok, status: r.status, raw };
      }
    });
  },
  login: (payload) => {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const raw = await r.text();
      try {
        return JSON.parse(raw);
      } catch {
        console.warn('Non-JSON response (login):', raw);
        return { ok: r.ok, status: r.status, raw };
      }
    });
  },
  // Admin-login (separat endpoint)
  adminLogin: (payload) => {
    return fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const raw = await r.text();
      try {
        return JSON.parse(raw);
      } catch {
        console.warn('Non-JSON response (admin login):', raw);
        return { ok: r.ok, status: r.status, raw };
      }
    });
  },
  // Helper for admin requests that require x-admin-key header
  adminFetch: (path, opts = {}) => {
    const key = localStorage.getItem('peerRateAdminKey') || '';
    const headers = Object.assign({}, opts.headers || {}, key ? { 'x-admin-key': key } : {});
    return fetch(path, Object.assign({}, opts, { headers } )).then(async (r) => {
      const raw = await r.text();
      try {
        return JSON.parse(raw);
      } catch {
        return { ok: r.ok, status: r.status, raw };
      }
    });
  },
  searchCustomers: (q) => {
    return fetch(`/api/customers?q=${encodeURIComponent(q)}`, {
      method: 'GET',
    }).then(async (r) => {
      const raw = await r.text();
      try {
        return JSON.parse(raw);
      } catch {
        console.warn('Non-JSON response (searchCustomers):', raw);
        return { ok: r.ok, status: r.status, raw };
      }
    });
  },
};

export default api;