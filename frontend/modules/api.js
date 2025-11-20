// api.js - Hanterar API-anrop till backend

// liten helper för att hämta ev. auth-token från localStorage (utan att krascha på server)
function getAuthToken() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // testa flera vanliga nycklar
    return (
      localStorage.getItem('peerRateToken') ||
      localStorage.getItem('token') ||
      null
    );
  } catch {
    return null;
  }
}

// bygger headers med ev. Authorization-header
function buildAuthHeaders(baseHeaders = {}) {
  const headers = { ...baseHeaders };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const api = {
  createRating: (payload) => {
    return fetch('/api/ratings', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
      credentials: 'include',
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
      headers: { 'Content-Type': 'application/json' }, // registrering kan vara öppen
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
      credentials: 'include',
    }).then(async (r) => {
      const raw = await r.text();
      try {
        const json = JSON.parse(raw);
        // om backend skickar med token kan vi cacha den
        if (json && json.token) {
          try {
            localStorage.setItem('peerRateToken', json.token);
          } catch {
            // ignore
          }
        }
        return json;
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
    const key =
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('peerRateAdminKey')) ||
      '';
    const headers = Object.assign(
      {},
      opts.headers || {},
      key ? { 'x-admin-key': key } : {}
    );
    return fetch(
      path,
      Object.assign({}, opts, {
        headers,
      })
    ).then(async (r) => {
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
      headers: buildAuthHeaders(),
      credentials: 'include',
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

  // Internal helper to perform GET requests with consistent auth/credentials
  _clientGet: async (path) => {
    try {
      const res = await fetch(path, {
        method: 'GET',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include', // skicka cookies också
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { ok: res.ok, status: res.status, raw: text };
      }
    } catch (err) {
      console.error('api._clientGet error', err);
      return null;
    }
  },

  // Hämta aktuell inloggad kund — försök flera vanliga endpoints, annars fallback till localStorage
  getCurrentCustomer: async () => {
    const endpoints = ['/api/customers/me', '/api/auth/me', '/api/profile/me'];
    for (const ep of endpoints) {
      try {
        const json = await api._clientGet(ep);
        if (!json) continue;
        // Common shapes: { ok: true, customer: {...} } or { ok: true, ...customer fields... }
        if (json && json.ok && json.customer) return json.customer;
        if (json && json.customer) return json.customer;
        // If endpoint returns the customer object directly
        if (json && json.id && (json.email || json.subjectRef)) return json;
      } catch (err) {
        // ignore and try next
        continue;
      }
    }

    // Fallback: try to read from localStorage (client-side cached user)
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('peerRateUser')
          : null;
      if (!raw) return null;
      const cached = JSON.parse(raw);
      // If we have an email/subjectRef, try to fetch a fresh server-side record via searchCustomers
      const q = cached.email || cached.subjectRef || cached.id || null;
      if (q) {
        try {
          const found = await api.searchCustomers(q);
          if (
            found &&
            found.ok &&
            Array.isArray(found.customers) &&
            found.customers.length
          ) {
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

  // Hämta externa data för inloggad kund via backend (använder samma auth/credentials som getCurrentCustomer)
  getExternalDataForCurrentCustomer: async () => {
    try {
      // För MVP: backend erbjuder publik endpoint som tar ?email=...
      const current = await api.getCurrentCustomer();
      const email = (current && (current.email || current.subjectRef)) || null;
      if (!email) return null;
      const path = `/api/customers/external-data?email=${encodeURIComponent(email)}`;
      const json = await api._clientGet(path);
      return json;
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

      const avgP = fetch(
        `/api/ratings/average?subject=${encodeURIComponent(subject)}`,
        {
          method: 'GET',
        }
      ).then(async (r) => {
        if (!r.ok) return null;
        try {
          return await r.json();
        } catch {
          return null;
        }
      });

      const listP = fetch(
        `/api/ratings?subject=${encodeURIComponent(subject)}`,
        {
          method: 'GET',
        }
      ).then(async (r) => {
        if (!r.ok) return null;
        try {
          return await r.json();
        } catch {
          return null;
        }
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
