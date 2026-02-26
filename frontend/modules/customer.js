// frontend/modules/customer.js
import { showNotification } from './utils.js';

function setStatus(msg) {
  const el = document.getElementById('customer-status');
  if (el) el.textContent = msg || '';
}

export function initCustomerForm() {
  const form = document.getElementById('customer-form');
  if (!form) return null;

  if (form.dataset.bound === '1') return form;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const email = (document.getElementById('email')?.value || '').trim();
    const password = document.getElementById('password')?.value || '';
    const password2 = document.getElementById('password2')?.value || '';
    const termsAccepted = document.getElementById('termsAccepted')?.checked === true;

    if (!email) return setStatus('Fyll i e-post.');
    if (!password || password.length < 8) return setStatus('Lösenord måste vara minst 8 tecken.');
    if (password !== password2) return setStatus('Lösenorden matchar inte.');

    // Viktigt: backend kräver att båda är true.
    // Vi använder samma checkbox för båda (enklast tills vi bygger “samtycke”-UI separat).
    if (!termsAccepted) {
      return setStatus('Du måste godkänna villkoren för att skapa konto.');
    }

    const payload = {
      email,
      emailConfirm: email,
      password,
      passwordConfirm: password2,
      termsAccepted: true,
      thirdPartyConsent: true,
    };

    console.log('DEBUG customer payload (step1):', payload);

    let resp;
    try {
      resp = await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Customer fetch error:', err);
      return setStatus('Kunde inte kontakta servern. Försök igen.');
    }

    let data = {};
    try { data = await resp.json(); } catch {}

    console.log('DEBUG /api/customers status:', resp.status, 'response:', data);

    if (resp.status === 409) {
      return setStatus(data?.error || 'Det finns redan ett konto med denna e-post.');
    }
    if (!resp.ok) {
      return setStatus(data?.error || 'Något gick fel vid registreringen.');
    }

    setStatus('Klart! Konto skapat. Du kan nu logga in.');
    if (typeof showNotification === 'function') {
      showNotification('success', 'Konto skapat! Du kan nu logga in.', 'customer-status');
    }
    form.reset();
  });

  return form;
}

// bakåtkompabilitet
const form = initCustomerForm();
export default form;
