console.log('script.js loaded');

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  const el = (id) => document.getElementById(id);

  // ---- API helper: tål även icke-JSON svar (för debugging) ----
  const api = {
    createRating: (payload) => {
      console.log('About to fetch /api/ratings with payload:', payload);
      return fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const raw = await r.text();
        try {
          const json = JSON.parse(raw);
          return json;
        } catch {
          console.warn('Non-JSON response:', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
    createCustomer: (payload) => {
      console.log('About to fetch /api/customers with payload:', payload);
      return fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  // ---- Notiser för betygsformuläret ----
  let noticeTimer = null;
  function showNotice(ok, msg) {
    const box = el('notice');
    if (!box) return console.warn('notice box saknas');
    box.className = 'notice ' + (ok ? 'ok' : 'err');
    box.textContent = msg;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      box.className = 'notice';
      box.textContent = '';
    }, 6000);
  }
  function clearNotice() {
    const box = el('notice');
    if (!box) return;
    clearTimeout(noticeTimer);
    box.className = 'notice';
    box.textContent = '';
  }

  // ---- Filer (valfritt) för rapport ----
  const filesInput = document.getElementById('reportFiles');
  const fileList = document.getElementById('fileList');
  function readFiles() {
    if (!filesInput || !fileList) return Promise.resolve([]);
    fileList.innerHTML = '';
    const files = Array.from(filesInput.files || []);
    const limited = files.slice(0, 3);
    const over = files.length > 3;
    if (over) showNotice(false, 'Max tre filer – övriga ignoreras.');
    limited.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = `${f.name} (${Math.round(f.size / 1024)} kB)`;
      fileList.appendChild(li);
    });
    return Promise.all(
      limited.map(
        (f) =>
          new Promise((resolve) => {
            if (f.size > 2 * 1024 * 1024) {
              showNotice(false, `${f.name} är större än 2 MB och ignoreras.`);
              return resolve(null);
            }
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: f.name,
                type: f.type,
                size: f.size,
                data: String(reader.result).split(',')[1],
              });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(f);
          })
      )
    ).then((arr) => arr.filter(Boolean));
  }

  // ---- Datum+tid till ISO ----
  function getReportWhenISO(dateStr, timeStr) {
    if (!dateStr && !timeStr) return null;
    const d = dateStr || new Date().toISOString().slice(0, 10);
    const t = timeStr || '00:00';
    const iso = new Date(`${d}T${t}`);
    return isNaN(iso.getTime()) ? null : iso.toISOString();
  }

  // ============================================================
  // BETYGFORMULÄR (index.html) – bara om rate-form finns
  // ============================================================
  const form = document.getElementById('rate-form');
  if (!form) {
    console.log('rate-form saknas – hoppar över betygslogik (t.ex. på customer.html)');
  } else {
    console.log('Submit listener will attach…');

    form.addEventListener('submit', async (e) => {
      console.log('Submit clicked');
      e.preventDefault();
      clearNotice();

      const subject = el('subject')?.value?.trim() || '';
      const rater = el('rater')?.value?.trim() || '';
      const ratingRaw = el('rating')?.value || '';
      const rating = parseInt(ratingRaw, 10);
      const comment = el('comment')?.value?.trim() || '';
      const proofRef = el('proofRef')?.value?.trim() || '';
      const flag = document.getElementById('reportFlag')?.checked || false;

      console.log('Form values:', { subject, ratingRaw, rating, rater, comment, proofRef, flag });

      if (!subject) return showNotice(false, 'Fyll i vem du betygsätter.');
      if (!ratingRaw || !Number.isInteger(rating) || rating < 1 || rating > 5)
        return showNotice(false, 'Välj betyg 1–5.');

      let reportPayload = null;
      if (flag) {
        const reason = el('reportReason')?.value || '';
        const dateS = el('reportDate')?.value || '';
        const timeS = el('reportTime')?.value || '';
        const whenISO = getReportWhenISO(dateS, timeS);
        const amount = el('reportAmount')?.value ? Number(el('reportAmount').value) : null;
        const link = el('reportLink')?.value?.trim() || null;
        const rtext = el('reportText')?.value?.trim() || '';
        const evid = el('evidenceUrl')?.value?.trim() || null;
        const cons = !!document.getElementById('reportConsent')?.checked;

        if (!cons) return showNotice(false, 'Bocka i intygandet under rapportering.');
        if (!reason) return showNotice(false, 'Välj typ av problem.');
        if (!rtext) return showNotice(false, 'Beskriv händelsen kort.');

        const filesPayload = await readFiles();

        reportPayload = {
          report_flag: true,
          report_reason: reason,
          report_when: whenISO,
          report_amount_sek: amount,
          report_link: link,
          report_text: rtext,
          evidence_url: evid,
          report_consent: cons,
          report_files: filesPayload,
        };
      }

      try {
        const body = {
          subject,
          rating,
          comment: comment || null,
          proofRef: proofRef || null,
          ...(reportPayload ? { report: reportPayload } : {}),
        };
        if (rater && rater.length >= 2) body.rater = rater;

        const res = await api.createRating(body);

        console.log('API response:', res);

        if (res && (res.ok || res.id || res.created)) {
          showNotice(true, 'Tack för ditt omdöme – det har skickats.');
          e.target.reset();
          el('rating').value = '';
          if (fileList) fileList.innerHTML = '';
        } else {
          const msg = res?.error || res?.message || `Något gick fel. (status: ${res?.status ?? 'ok?'})`;
          showNotice(false, msg);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        showNotice(false, 'Nätverksfel. Försök igen.');
      }
    });

    // ---- Reset-knapp ----
    const resetBtn = document.getElementById('reset-form');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        form.reset();
        el('rating').value = '';
        if (fileList) fileList.innerHTML = '';
        clearNotice();
      });
    }
  }

  // ============================================================
  // KUNDREGISTRERING (customer.html)
  // ============================================================
  const customerForm = document.getElementById('customer-form');
  if (customerForm) {
    console.log('Customer form found, attaching handlers…');

    let custNoticeTimer = null;
    function showCustNotice(ok, msg) {
      const box = el('cust-notice');
      if (!box) return;
      box.className = 'notice ' + (ok ? 'ok' : 'err');
      box.textContent = msg;
      clearTimeout(custNoticeTimer);
      custNoticeTimer = setTimeout(() => {
        box.className = 'notice';
        box.textContent = '';
      }, 7000);
    }
    function clearCustNotice() {
      const box = el('cust-notice');
      if (!box) return;
      clearTimeout(custNoticeTimer);
      box.className = 'notice';
      box.textContent = '';
    }

    customerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearCustNotice();

      const firstName = el('cust-firstName')?.value?.trim() || '';
      const lastName = el('cust-lastName')?.value?.trim() || '';
      const personalNumber = el('cust-personalNumber')?.value?.trim() || '';
      const email = el('cust-email')?.value?.trim() || '';
      const emailConfirm = el('cust-emailConfirm')?.value?.trim() || '';
      const phone = el('cust-phone')?.value?.trim() || '';
      const addressStreet = el('cust-addressStreet')?.value?.trim() || '';
      const addressZip = el('cust-addressZip')?.value?.trim() || '';
      const addressCity = el('cust-addressCity')?.value?.trim() || '';
      const country = el('cust-country')?.value?.trim() || '';

      if (!firstName || !lastName) {
        return showCustNotice(false, 'Fyll i både förnamn och efternamn.');
      }

      if (!personalNumber || !/^\d{10,12}$/.test(personalNumber)) {
        return showCustNotice(false, 'Fyll i ett giltigt personnummer med 10–12 siffror.');
      }

      if (!email || !emailConfirm) {
        return showCustNotice(false, 'Fyll i och bekräfta din e-postadress.');
      }
      if (email.toLowerCase() !== emailConfirm.toLowerCase()) {
        return showCustNotice(false, 'E-postadresserna matchar inte.');
      }

      if (phone && !/^[0-9+\s\-()]*$/.test(phone)) {
        return showCustNotice(false, 'Telefonnummer får bara innehålla siffror, mellanslag, +, -, ().');
      }

      const body = {
        firstName,
        lastName,
        personalNumber,
        email,
        emailConfirm,
        phone: phone || null,
        addressStreet: addressStreet || null,
        addressZip: addressZip || null,
        addressCity: addressCity || null,
        country: country || null,
      };

      try {
        const res = await api.createCustomer(body);
        console.log('Customer API response:', res);

        if (res && res.ok) {
          showCustNotice(true, 'Tack! Din registrering har sparats.');
          customerForm.reset();
        } else {
          const msg =
            res?.error ||
            res?.message ||
            (res?.status === 409
              ? 'Det finns redan en användare med samma e-post eller personnummer.'
              : `Något gick fel. (status: ${res?.status ?? 'ok?'})`);
          showCustNotice(false, msg);
        }
      } catch (err) {
        console.error('Customer fetch error:', err);
        showCustNotice(false, 'Nätverksfel. Försök igen.');
      }
    });
  }
});
