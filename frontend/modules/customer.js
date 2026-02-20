// frontend/modules/customer.js
// Hanterar registreringslogik (customer.html)

import { el, showNotification, clearNotice } from './utils.js';

export function initCustomerForm() {
  const customerForm = document.getElementById('customer-form');
  if (!customerForm) return;

  console.log('Customer form loaded');

  customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearNotice();

    const body = {
      firstName: el('cust-firstName')?.value?.trim() || '',
      lastName: el('cust-lastName')?.value?.trim() || '',
      personalNumber: el('cust-personalNumber')?.value?.trim() || '',
      email: el('cust-email')?.value?.trim() || '',
      emailConfirm: el('cust-emailConfirm')?.value?.trim() || '',
      password: el('cust-password')?.value || '',
      passwordConfirm: el('cust-passwordConfirm')?.value || '',
      phone: el('cust-phone')?.value?.trim() || '',
      addressStreet: el('cust-addressStreet')?.value?.trim() || '',
      addressZip: el('cust-addressZip')?.value?.trim() || '',
      addressCity: el('cust-addressCity')?.value?.trim() || '',
      country: el('cust-country')?.value?.trim() || '',
      thirdPartyConsent: el('cust-thirdPartyConsent')?.checked || false,
      termsAccepted: el('cust-termsAccepted')?.checked || false,
    };

    console.log('DEBUG customer payload (before send):', body);

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

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      const message =
        data?.error || data?.message || 'Något gick fel vid registreringen.';
      showNotification('error', message, 'cust-notice');
      return;
    }

    showNotification('success', 'Tack! Din registrering är mottagen.', 'cust-notice');
    customerForm.reset();
  });
}
