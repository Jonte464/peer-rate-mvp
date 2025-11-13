console.log('customer.js loaded (customer page)');

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready (customer page)');

  const el = (id) => document.getElementById(id);

  // ---- API helper: customers ----
  const api = {
    createCustomer: (payload) => {
      console.log('About to fetch /api/customers with payload:', payload);
      return fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const raw = await r.text();
        try {
          const json = JSON.parse(raw);
          return json;
        } catch {
          console.warn('Non-JSON response (customers):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
  };

  // ---- Notiser (för kundregister) ----
  let customerNoticeTimer = null;
  function showCustomerNotice(ok, msg) {
    const box = el('customer-notice');
    if (!box) return console.warn('customer-notice saknas');
    box.className = 'notice ' + (ok ? 'ok' : 'err');
    box.textContent = msg;
    clearTimeout(customerNoticeTimer);
    customerNoticeTimer = setTimeout(() => {
      box.className = 'notice';
      box.textContent = '';
    }, 6000);
  }
  function clearCustomerNotice() {
    const box = el('customer-notice');
    if (!box) return;
    clearTimeout(customerNoticeTimer);
    box.className = 'notice';
    box.textContent = '';
  }

  const customerForm = document.getElementById('customer-form');
  if (!customerForm) {
    console.error('customer-form saknas i DOM');
    return;
  }

  console.log('Submit listener for customer-form will attach…');

  customerForm.addEventListener('submit', async (e) => {
    console.log('Submit clicked (customer-form)');
    e.preventDefault();
    clearCustomerNotice();

    const subjectRef = el('customerSubjectRef')?.value?.trim() || '';
    const fullName   = el('customerFullName')?.value?.trim() || '';
    const personalNumber = el('customerPersonalNumber')?.value?.trim() || '';
    const email      = el('customerEmail')?.value?.trim() || '';
    const phone      = el('customerPhone')?.value?.trim() || '';
    const street     = el('customerStreet')?.value?.trim() || '';
    const zip        = el('customerZip')?.value?.trim() || '';
    const city       = el('customerCity')?.value?.trim() || '';
    const country    = el('customerCountry')?.value?.trim() || '';

    console.log('Form values (customer):', {
      subjectRef, fullName, personalNumber, email, phone, street, zip, city, country
    });

    if (!subjectRef) return showCustomerNotice(false, 'Fyll i subjectRef/kund-ID.');
    if (!fullName)   return showCustomerNotice(false, 'Fyll i kundens fullständiga namn.');

    if (personalNumber && !/^\d{10,12}$/.test(personalNumber)) {
      return showCustomerNotice(false, 'Personnummer ska vara 10–12 siffror utan bindestreck.');
    }

    const payload = {
      subjectRef,
      fullName,
      personalNumber: personalNumber || null,
      email: email || null,
      phone: phone || null,
      addressStreet: street || null,
      addressZip: zip || null,
      addressCity: city || null,
      country: country || null,
    };

    try {
      const res = await api.createCustomer(payload);
      console.log('API response (customer):', res);

      if (res && res.ok) {
        showCustomerNotice(true, 'Kunden har sparats i registret.');
        e.target.reset();
      } else {
        const msg = res?.error || res?.message || `Något gick fel. (status: ${res?.status ?? 'ok?'})`;
        showCustomerNotice(false, msg);
      }
    } catch (err) {
      console.error('Fetch error (customers):', err);
      showCustomerNotice(false, 'Nätverksfel. Försök igen.');
    }
  });

  const resetCustomerBtn = document.getElementById('reset-customer-form');
  if (resetCustomerBtn) {
    resetCustomerBtn.addEventListener('click', () => {
      customerForm.reset();
      clearCustomerNotice();
    });
  }
});
