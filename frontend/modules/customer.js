// frontend/modules/customer.js
import { showNotification } from './utils.js';

function setStatus(msg) {
  const el = document.getElementById('customer-status');
  if (el) el.textContent = msg || '';
}

function notify(type, msg) {
  if (typeof showNotification === 'function') {
    showNotification(type, msg, 'customer-status');
  } else {
    setStatus(msg);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
    if (!termsAccepted) return setStatus('Du måste godkänna villkoren för att skapa konto.');

    const payload = {
      email,
      emailConfirm: email,
      password,
      passwordConfirm: password2,
      termsAccepted: true,
      thirdPartyConsent: true,
    };

    console.log('DEBUG customer payload (step1):', payload);
    notify('info', 'Registrerar...');

    // 🔥 VIKTIGT: Bypass-proxy för test (byt tillbaka senare om proxy fixas)
    const url = 'https://api.peerrate.ai/api/customers/register';
    // Om du vill testa proxyvägen igen senare, använd:
    // const url = '/api/customers/register';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error('Customer fetch error:', err);

      if (err?.name === 'AbortError') {
        return notify('error', 'Servern svarar inte (timeout). Försök igen.');
      }
      return notify('error', 'Kunde inte kontakta servern. Försök igen.');
    } finally {
      clearTimeout(timeout);
    }

    let data = {};
    let rawText = '';
    try {
      rawText = await resp.text();
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }
    } catch {}

    console.log('DEBUG /api/customers status:', resp.status, 'ok:', resp.ok, 'response:', data);

    if (resp.status === 409) {
      return notify('error', data?.error || 'Det finns redan ett konto med denna e-post.');
    }
    if (!resp.ok) {
      return notify('error', data?.error || `Något gick fel vid registreringen (status ${resp.status}).`);
    }

    notify('success', 'Tack! Konto skapat. Du kan nu logga in.');
    form.reset();

    // Liten paus så användaren ser meddelandet
    await sleep(600);
  });

  return form;
}

const form = initCustomerForm();
export default form;