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
  // Hämta aktuell inloggad kund — försök flera vanliga endpoints, annars fallback till localStorage
  getCurrentCustomer: async () => {
    const endpoints = ['/api/customers/me', '/api/auth/me', '/api/profile/me'];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!res) continue;
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          // Common shapes: { ok: true, customer: {...} } or { ok: true, ...customer fields... }
          if (json && json.ok && json.customer) return json.customer;
          if (json && json.customer) return json.customer;
          // If endpoint returns the customer object directly
          if (json && json.id && (json.email || json.subjectRef)) return json;
        } catch (err) {
          // Non-JSON or unexpected — skip
          continue;
        }
      } catch (err) {
        // Network error — try next
        continue;
      }
    }

    // Fallback: try to read from localStorage (client-side cached user)
    try {
      const raw = localStorage.getItem('peerRateUser');
      if (!raw) return null;
      const cached = JSON.parse(raw);
      // If we have an email/subjectRef, try to fetch a fresh server-side record via searchCustomers
      const q = cached.email || cached.subjectRef || cached.id || null;
      if (q) {
        try {
          const found = await api.searchCustomers(q);
          if (found && found.ok && Array.isArray(found.customers) && found.customers.length) {
            return found.customers[0];
          }
        } catch (err) {
          // ignore and fallback to cached
        }
      }
      return cached;
    } catch (err) {
      return null;
    }
  },
  // Hämta externa data för inloggad kund via backend
  getExternalDataForCurrentCustomer: async () => {
    // Använder samma fetch-mönster som övriga API-anrop
    try {
      const res = await fetch('/api/customers/me/external-data', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('external-data API error');
      return await res.json();
    } catch (err) {
      console.error('getExternalDataForCurrentCustomer error', err);
      return null;
    }
  },

  // Hämta mitt omdöme (average + senaste ratings) för inloggad kund
  getMyRating: async () => {
    try {
      // Först: hitta aktuell kund (subjectRef/email)
      const current = await api.getCurrentCustomer();
      const subject = (current && (current.subjectRef || current.email)) || null;
      if (!subject) return null;

      const avgP = fetch(`/api/ratings/average?subject=${encodeURIComponent(subject)}`, { method: 'GET' }).then(async (r) => {
        if (!r.ok) return null;
        try { return await r.json(); } catch { return null; }
      });

      const listP = fetch(`/api/ratings?subject=${encodeURIComponent(subject)}`, { method: 'GET' }).then(async (r) => {
        if (!r.ok) return null;
        try { return await r.json(); } catch { return null; }
      });

      const [avg, list] = await Promise.all([avgP, listP]);
      const result = { average: null, count: 0, ratings: [] };
      if (avg && avg.ok) {
        result.average = avg.average ?? null;
        result.count = avg.count ?? 0;
      }
      if (list && list.ok && Array.isArray(list.ratings)) {
        result.ratings = list.ratings;
      }
      return result;
    } catch (err) {
      console.error('getMyRating error', err);
      return null;
    }
  },
};

export default api;