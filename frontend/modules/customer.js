// customer.js - Hanterar registreringslogik

import api from './api.js';
import { el, showNotice, clearNotice } from './utils.js';

const customerForm = el('customer-form');
if (customerForm) {
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

    try {
      const res = await api.createCustomer(body);
      console.log('Customer API response:', res);

      if (res && res.ok) {
        showNotice(true, 'Tack! Din registrering har sparats.');
        customerForm.reset();
      } else {
        const msg = res?.error || 'Något gick fel.';
        showNotice(false, msg);
      }
    } catch (err) {
      console.error('Customer fetch error:', err);
      showNotice(false, 'Nätverksfel. Försök igen.');
    }
  });
}

export default customerForm;