// frontend/modules/customer.js
// Minimal registrering: email + password (+ confirm)

import { el, showNotification, clearNotice } from './utils.js';

const form = el('customer-form');

function getVal(id) {
  const n = el(id);
  return n ? (n.value || '').trim() : '';
}

if (form) {
  console.log('Customer form loaded (minimal)');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearNotice();

    const email = getVal('cust-email');
    const password = getVal('cust-password');
    const passwordConfirm = getVal('cust-passwordConfirm');

    if (!email) {
      showNotification('error', 'Fyll i e-post.', 'cust-notice');
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

    const payload = { email, password };
    console.log('DEBUG register payload:', payload);

    let response;
    try {
      response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Register network error:', err);
      showNotification('error', 'Kunde inte kontakta servern. Försök igen.', 'cust-notice');
      return;
    }

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    if (response.status === 409) {
      showNotification('error', data?.error || 'Det finns redan ett konto med den e-posten.', 'cust-notice');
      return;
    }

    if (!response.ok) {
      showNotification('error', data?.error || 'Registrering misslyckades.', 'cust-notice');
      return;
    }

    showNotification('success', 'Klart! Kontot är skapat. Du kan logga in nu.', 'cust-notice');
    form.reset();
  });
}
