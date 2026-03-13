// frontend/js/rate-api.js
// API-modul för rate-sidan.
// Ansvar:
// - skicka rating till backend
// - kontrollera deal-status/duplicate i backend
// - normalisera felmeddelanden

const CREATE_RATING_ENDPOINT = '/api/ratings';
const CHECK_DEAL_STATUS_ENDPOINT = '/api/ratings/check-deal-status';

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readResponse(res) {
  const raw = await res.text();
  const json = safeParseJson(raw);

  return {
    ok: res.ok,
    status: res.status,
    raw,
    json,
  };
}

export async function createRating(payload) {
  try {
    const res = await fetch(CREATE_RATING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload || {}),
    });

    const parsed = await readResponse(res);

    if (parsed.ok) {
      return {
        ok: true,
        status: parsed.status,
        data: parsed.json || null,
      };
    }

    return {
      ok: false,
      status: parsed.status,
      error:
        parsed.json?.error ||
        parsed.json?.message ||
        `Request failed (${parsed.status})`,
      raw: parsed.raw || '',
      data: parsed.json || null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: String(err?.message || err || 'Network error'),
      raw: '',
      data: null,
    };
  }
}

export async function checkDealStatus(payload) {
  try {
    const res = await fetch(CHECK_DEAL_STATUS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload || {}),
    });

    const parsed = await readResponse(res);

    if (!parsed.ok) {
      return {
        ok: false,
        status: parsed.status,
        error:
          parsed.json?.error ||
          parsed.json?.message ||
          `Request failed (${parsed.status})`,
        raw: parsed.raw || '',
        data: parsed.json || null,
      };
    }

    return {
      ok: true,
      status: parsed.status,
      data: parsed.json || null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: String(err?.message || err || 'Network error'),
      raw: '',
      data: null,
    };
  }
}