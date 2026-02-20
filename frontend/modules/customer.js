// frontend/modules/customer.js
// Robust registreringslogik för customer.html (tål olika input-id:n)

import { showNotification, clearNotice } from './utils.js';

function pickValue(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && typeof el.value === 'string') return el.value.trim();
  }
  return '';
}

function pickChecked(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && typeof el.checked === 'boolean') return el.checked;
  }
  return false;
}

export function initCustomerForm() {
  const form =
    document.getElementById('customer-form') ||
    document.querySelector('form');

  if (!form) return;

  console.log('Customer form loaded');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearNotice();

    // ✅ Hitta fält även om de heter olika i HTML
    const email = pickValue([
      '#cust-email',
      '#email',
      'input[name="email"]',
      'input[type="email"]',
    ]);

    const password = pickValue([
      '#cust-password',
      '#password',
      'input[name="password"]',
      'input[type="password"]',
    ]);

    const passwordConfirm = pickValue([
      '#cust-passwordConfirm',
      '#passwordConfirm',
      '#password2',
      'input[name="passwordConfirm"]',
      'input[name="password2"]',
    ]);

    const termsAccepted = pickChecked([
      '#cust-termsAccepted',
      '#termsAccepted',
      'input[name="termsAccepted"]',
    ]);

    const thirdPartyConsent = pickChecked([
      '#cust-thirdPartyConsent',
      '#thirdPartyConsent',
      'input[name="thirdPartyConsent"]',
    ]);

    const body = {
      email,
      password,
      passwordConfirm,
      termsAccepted,
      thirdPartyConsent,
    };

    console.log('DEBUG customer payload (before send):', body);

    // ✅ Snabb client-side check (så du ser direkt om email blir tom)
    if (!email) {
      showNotification('error', 'E-post saknas (fältet hittas inte i sidan).', 'cust-notice');
      return;
    }
    if (!password || password.length < 8) {
      showNotification('error', 'Lösenord måste vara minst 8 tecken.', 'cust-notice');
      return;
    }
    if (password !== passwordConfirm) {
      showNotification('error', 'Lösenorden matchar inte.', 'cust-notice');
      return;
    }

    let response;
    try {
      response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('Customer fetch error:', err);
      showNotification('error', 'Kunde inte kontakta servern.', 'cust-notice');
      return;
    }

    const raw = await response.text();
    let data = {};
    try { data = JSON.parse(raw); } catch (_) {}

    console.log('DEBUG /api/customers status:', response.status, 'response:', data || raw);

    if (!response.ok) {
      const msg = data?.error || data?.message || 'Något gick fel vid registreringen.';
      showNotification('error', msg, 'cust-notice');
      return;
    }

    showNotification('success', 'Tack! Ditt konto är skapat.', 'cust-notice');
    form.reset();
  });
}
