// frontend/modules/customer.js
import { showNotification } from './utils.js';

function setStatus(msg) {
  const el = document.getElementById('customer-status');
  if (el) el.textContent = msg || '';
}

export function initCustomerForm() {
  const form = document.getElementById('customer-form');
  if (!form) return null;

  // Undvik att vi råkar lägga på flera listeners vid om-init
  if (form.dataset.bound === '1') return form;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const email = (document.getElementById('email')?.value || '').trim();
    const password = document.getElementById('password')?.value || '';
    const password2 = document.getElementById('password2')?.value || '';

    if (!email) {
      setStatus('Fyll i e-post.');
      return;
    }
    if (!password || password.length < 8) {
      setStatus('Lösenord måste vara minst 8 tecken.');
      return;
    }
    const confirm = password2 || password;
    if (password !== confirm) {
      setStatus('Lösenorden matchar inte.');
      return;
    }

    const payload = {
      email,
      emailConfirm: email,
      password,
      passwordConfirm: confirm,
      // samtycken kan läggas till senare när du har checkboxar i UI
      // thirdPartyConsent: true,
      // termsAccepted: true,
    };

    console.log('DEBUG customer payload (step1):', payload);

    let resp;
    try {
      resp = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Customer fetch error:', err);
      setStatus('Kunde inte kontakta servern. Försök igen.');
      return;
    }

    let data = {};
    try { data = await resp.json(); } catch {}

    console.log('DEBUG /api/customers status:', resp.status, 'response:', data);

    if (resp.status === 409) {
      setStatus(data?.error || 'Det finns redan ett konto med denna e-post.');
      return;
    }

    if (!resp.ok) {
      setStatus(data?.error || 'Något gick fel vid registreringen.');
      return;
    }

    setStatus('Klart! Konto skapat. Du kan nu logga in.');
    if (typeof showNotification === 'function') {
      showNotification('success', 'Konto skapat! Du kan nu logga in.', 'customer-status');
    }
  });

  return form;
}

// För bakåtkompabilitet om något fortfarande importerar default:
const form = initCustomerForm();
export default form;
