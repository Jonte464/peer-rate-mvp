 const el = (id) => document.getElementById(id);
    const api = {
      create: (payload) => fetch('/api/ratings', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      }).then(r => r.json()),
    };

    // Notis
    let noticeTimer=null;
    function showNotice(ok, msg){
      const box = el('notice');
      box.className = 'notice ' + (ok ? 'ok' : 'err');
      box.textContent = msg;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { box.className='notice'; box.textContent=''; }, 6000);
    }
    function clearNotice(){
      const box = el('notice');
      clearTimeout(noticeTimer);
      box.className = 'notice';
      box.textContent = '';
    }

    // Filer → base64 (valfritt)
    const filesInput = document.getElementById('reportFiles');
    const fileList = document.getElementById('fileList');
    function readFiles(){
      if (!filesInput || !fileList) return Promise.resolve([]);
      fileList.innerHTML='';
      const files = Array.from(filesInput.files||[]);
      const limited = files.slice(0,3);
      const over = files.length>3;
      if (over) showNotice(false,'Max tre filer – övriga ignoreras.');
      limited.forEach(f=>{
        const li = document.createElement('li');
        li.textContent = `${f.name} (${Math.round(f.size/1024)} kB)`;
        fileList.appendChild(li);
      });
      return Promise.all(limited.map(f => new Promise((resolve)=>{
        if (f.size > 2*1024*1024){
          showNotice(false, `${f.name} är större än 2 MB och ignoreras.`);
          return resolve(null);
        }
        const reader = new FileReader();
        reader.onload = () => resolve({name:f.name,type:f.type,size:f.size,data:String(reader.result).split(',')[1]});
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(f);
      }))).then(arr => arr.filter(Boolean));
    }

    // Kombinera datum + tid → ISO (lokal)
    function getReportWhenISO(dateStr, timeStr){
      if(!dateStr && !timeStr) return null;
      const d = dateStr || new Date().toISOString().slice(0,10); // fallback dagens datum
      const t = timeStr || "00:00";
      const iso = new Date(`${d}T${t}`);
      return isNaN(iso.getTime()) ? null : iso.toISOString();
    }

    // Skicka betyg
    document.getElementById('rate-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearNotice();

      const subject = el('subject').value.trim();
      const rater   = el('rater').value.trim();
      const ratingRaw = el('rating').value;
      const rating  = parseInt(ratingRaw, 10);
      const comment = el('comment').value.trim();
      const proofRef= el('proofRef').value.trim();
      const flag    = document.getElementById('reportFlag').checked;

      if (!subject) return showNotice(false,'Fyll i vem du betygsätter.');
      if (!ratingRaw || !Number.isInteger(rating) || rating < 1 || rating > 5)
        return showNotice(false,'Välj betyg 1–5.');

      let reportPayload = null;
      if (flag){
        const reason = el('reportReason').value;
        const dateS  = el('reportDate').value;
        const timeS  = el('reportTime').value;
        const whenISO= getReportWhenISO(dateS,timeS);
        const amount = el('reportAmount').value ? Number(el('reportAmount').value) : null;
        const link   = el('reportLink').value.trim() || null;
        const rtext  = el('reportText').value.trim();
        const evid   = el('evidenceUrl').value.trim() || null;
        const cons   = el('reportConsent').checked;

        if (!cons) return showNotice(false,'Bocka i intygandet under rapportering.');
        if (!reason) return showNotice(false,'Välj typ av problem.');
        if (!rtext)  return showNotice(false,'Beskriv händelsen kort.');

        const filesPayload = await readFiles();

        reportPayload = {
          report_flag: true,
          report_reason: reason,
          report_when: whenISO,
          report_amount_sek: amount,
          report_link: link,
          report_text: rtext,
          evidence_url: evid,
          report_consent: !!cons,
          report_files: filesPayload
        };
      }

      try {
        const res = await api.create({
          subject, rating, comment, rater, proofRef,
          ...(reportPayload ? { report: reportPayload } : {})
        });

        if (res && res.ok){
          showNotice(true,'Tack för ditt omdöme – det har skickats.');
          e.target.reset();
          el('rating').value = '';
          if (fileList) fileList.innerHTML = '';
        } else {
          showNotice(false, res?.error || 'Något gick fel. Försök igen.');
        }
      } catch {
        showNotice(false,'Nätverksfel. Försök igen.');
      }
    });

    document.getElementById('reset-form').addEventListener('click', () => {
      document.getElementById('rate-form').reset();
      el('rating').value = '';
      if (fileList) fileList.innerHTML = '';
      clearNotice();
    });