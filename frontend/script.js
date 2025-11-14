console.log('script.js loaded');

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  const el = (id) => document.getElementById(id);

  // Enkel auth-hjälpare (lagras i localStorage på klienten)
  const auth = {
    key: 'peerRateUser',
    getUser() {
      try {
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    setUser(user) {
      localStorage.setItem(this.key, JSON.stringify(user));
    },
    clear() {
      localStorage.removeItem(this.key);
    },
  };

  // ---- API helper ----
  const api = {
    createRating: (payload) => {
      return fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (ratings):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
    createCustomer: (payload) => {
      return fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (customers):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
    login: (payload) => {
      return fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const raw = await r.text();
        try {
          return JSON.parse(raw);
        } catch {
          console.warn('Non-JSON response (login):', raw);
          return { ok: r.ok, status: r.status, raw };
        }
      });
    },
  };

  // ---- Notiser för betyg ----
  let noticeTimer = null;
  function showNotice(ok, msg) {
    const box = el('notice');
    if (!box) return;
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

  // ---- Filer för rapport ----
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

  function getReportWhenISO(dateStr, timeStr) {
    if (!dateStr && !timeStr) return null;
    const d = dateStr || new Date().toISOString().slice(0, 10);
    const t = timeStr || '00:00';
    const iso = new Date(`${d}T${t}`);
    return isNaN(iso.getTime()) ? null : iso.toISOString();
  }

  // ============================================================
  // LOGIN-BLOCK (på betygssidan)
  // ============================================================
  const loginEmail = el('login-email');
  const loginPassword = el('login-password');
  const loginBtn = el('login-btn');
  const loginStatus = el('login-status');
  const loginHint = el('login-hint');
  const ratingFormWrapper = el('rating-form-wrapper');

  function updateLoginUI() {
    const user = auth.getUser();
    if (user && loginStatus) {
      // Inloggad
      loginStatus.textContent = `Inloggad som ${user.email || ''}${user.fullName ? ' (' + user.fullName + ')' : ''}.`;
      if (loginHint) {
        loginHint.textContent = 'Du är inloggad och kan lämna betyg direkt i formuläret nedan.';
      }
      if (ratingFormWrapper) {
        ratingFormWrapper.classList.remove('hidden');
      }
      if (loginEmail) loginEmail.value = user.email || '';
      if (loginPassword) loginPassword.value = '';
      const raterInput = el('rater');
      if (raterInput && !raterInput.value && user.email) {
        raterInput.value = user.email;
      }
    } else {
      // Inte inloggad
      if (loginStatus) loginStatus.textContent = 'Inte inloggad.';
      if (loginHint) {
        loginHint.innerHTML =
          'Du behöver logga in för att kunna lämna betyg. ' +
          'Logga in ovan eller ' +
          '<a href="/customer.html" target="_blank" rel="noopener noreferrer">registrera dig här</a>.';
      }
      if (ratingFormWrapper) {
        ratingFormWrapper.classList.add('hidden');
      }
    }
  }

  if (loginBtn && loginEmail && loginPassword) {
    loginBtn.addEventListener('click', async () => {
      const email = loginEmail.value.trim();
      const password = loginPassword.value.trim();

      if (!email || !password) {
        if (loginStatus) loginStatus.textContent = 'Fyll i både e-post och lösenord.';
        return;
      }

      if (loginStatus) loginStatus.textContent = 'Loggar in...';

      try {
        const res = await api.login({ email, password });
        console.log('Login response:', res);

        if (res && res.ok && res.customer) {
          auth.setUser({
            id: res.customer.id,
            email: res.customer.email,
            fullName: res.customer.fullName,
          });
          if (loginStatus) loginStatus.textContent = 'Inloggning lyckades.';
          updateLoginUI();

          // Scrolla ner till betygsformuläret så det känns "direkt"
          const formEl = el('rate-form');
          if (formEl) {
            formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else {
          const msg = res?.error || 'Inloggningen misslyckades.';
          if (loginStatus) loginStatus.textContent = msg;
        }
      } catch (err) {
        console.error('Login fetch error:', err);
        if (loginStatus) loginStatus.textContent = 'Nätverksfel vid inloggning.';
      }
    });
  }

  updateLoginUI();

  // ============================================================
  // BETYGFORMULÄR
  // ============================================================
  const form = document.getElementById('rate-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearNotice();

      const user = auth.getUser();
      if (!user) {
        showNotice(false, 'Du måste vara inloggad innan du lämnar betyg.');
        return;
      }

      const subject = el('subject')?.value?.trim() || '';
      let rater = el('rater')?.value?.trim() || '';
      const ratingRaw = el('rating')?.value || '';
      const rating = parseInt(ratingRaw, 10);
      const comment = el('comment')?.value?.trim() || '';
      const proofRef = el('proofRef')?.value?.trim() || '';
      const flag = document.getElementById('reportFlag')?.checked || false;

      if (!subject) return showNotice(false, 'Fyll i vem du betygsätter.');
      if (!ratingRaw || !Number.isInteger(rating) || rating < 1 || rating > 5)
        return showNotice(false, 'Välj betyg 1–5.');

      // om inget rater angetts, sätt till inloggad email
      if (!rater && user.email) {
        rater = user.email;
      }

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
        console.log('API response (rating):', res);

        if (res && (res.ok || res.id || res.created)) {
          showNotice(true, 'Tack för ditt omdöme – det har skickats.');
          e.target.reset();
          el('rating').value = '';
          if (fileList) fileList.innerHTML = '';
        } else {
          const msg =
            res?.error || res?.message || `Något gick fel. (status: ${res?.status ?? 'ok?'})`;
          showNotice(false, msg);
        }
      } catch (err) {
        console.error('Fetch error (rating):', err);
        showNotice(false, 'Nätverksfel. Försök igen.');
      }
    });

    const resetBtn = document.getElementById('reset-form');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        form.reset();
        const r = el('rating');
        if (r) r.value = '';
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
      const password = el('cust-password')?.value || '';
      const passwordConfirm = el('cust-passwordConfirm')?.value || '';
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
      if (!password || password.length < 8) {
        return showCustNotice(false, 'Lösenordet måste vara minst 8 tecken.');
      }
      if (password !== passwordConfirm) {
        return showCustNotice(false, 'Lösenorden matchar inte.');
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
        password,
        passwordConfirm,
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
          showCustNotice(true, 'Tack! Din registrering har sparats. Du kan nu logga in på sidan Lämna betyg.');
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
