// frontend/modules/customer.js - Registrering (matchar backend storage/createCustomer)

import { el, showNotification, clearNotice } from './utils.js';

const customerForm = el('customer-form');

function getVal(id) {
  return el(id)?.value?.trim() || '';
}

function getChecked(id) {
  return Boolean(el(id)?.checked);
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

if (customerForm) {
  customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearNotice();

    const firstName = getVal('cust-firstName');
    const lastName = getVal('cust-lastName');
    const fullName = `${firstName} ${lastName}`.trim();

    const email = getVal('cust-email').toLowerCase();
    const emailConfirm = getVal('cust-emailConfirm').toLowerCase();

    const password = el('cust-password')?.value || '';
    const passwordConfirm = el('cust-passwordConfirm')?.value || '';

    const termsAccepted = getChecked('cust-termsAccepted');
    const thirdPartyConsent = getChecked('cust-thirdPartyConsent');

    // --- Enkel validering i frontend ---
    if (!email) {
      showNotification('error', 'Fyll i e-post.', 'cust-notice');
      return;
    }
    if (emailConfirm && emailConfirm !== email) {
      showNotification('error', 'E-postadresserna matchar inte.', 'cust-notice');
      return;
    }
    if (!password || password.length < 6) {
      showNotification('error', 'Lösenordet måste vara minst 6 tecken.', 'cust-notice');
      return;
    }
    if (passwordConfirm && passwordConfirm !== password) {
      showNotification('error', 'Lösenorden matchar inte.', 'cust-notice');
      return;
    }
    if (!termsAccepted) {
      showNotification('error', 'Du måste acceptera villkoren för att registrera dig.', 'cust-notice');
      return;
    }

    // --- Payload som backend med största sannolikhet förväntar sig ---
    const body = {
      subjectRef: email,               // vi använder email som subjectRef
      fullName: fullName || null,
      personalNumber: getVal('cust-personalNumber') || null,
      email: email,
      phone: getVal('cust-phone') || null,
      addressStreet: getVal('cust-addressStreet') || null,
      addressZip: getVal('cust-addressZip') || null,
      addressCity: getVal('cust-addressCity') || null,
      country: getVal('cust-country') || null,
      password,                        // backend ska hasha detta -> passwordHash
      thirdPartyConsent,
      termsAccepted,                   // om backend ignorerar ok, annars bra att ha
    };

    console.log('DEBUG customer payload (before send):', body);

    let res;
    try {
      res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('Customer fetch error:', err);
      showNotification('error', 'Kunde inte kontakta servern. Försök igen.', 'cust-notice');
      return;
    }

    const data = await readJsonSafe(res);

    if (res.status === 409) {
      showNotification(
        'error',
        data?.error || 'Det finns redan ett konto med samma e-post/personnummer.',
        'cust-notice'
      );
      return;
    }

    if (!res.ok) {
      // Viktigt: visa serverns feltext så vi snabbt ser exakt vad som saknas
      const msg = data?.error || data?.message || `Registrering misslyckades (${res.status}).`;
      showNotification('error', msg, 'cust-notice');
      console.warn('Register failed:', { status: res.status, data });
      return;
    }

    showNotification('success', 'Konto skapat! Du kan nu logga in.', 'cust-notice');
    customerForm.reset();
  });
}

export default customerForm;
