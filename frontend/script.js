function el(id){ return document.getElementById(id); }
function show(e){ e.hidden = false; }
function hide(e){ e.hidden = true; }
function setNotice(type, msg){
  const n = el('notice');
  n.className = 'notice ' + (type || '');
  n.textContent = msg || '';
  if (msg) show(n); else hide(n);
}

async function getJSON(url){
  const r = await fetch(url);
  const b = await r.json().catch(()=> ({}));
  return { ok: r.ok, status: r.status, body: b };
}
async function postJSON(url,data){
  const r = await fetch(url,{
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(data)
  });
  const b = await r.json().catch(()=> ({}));
  return { ok: r.ok, status: r.status, body: b };
}

async function loadRecent(){
  const res = await getJSON('/api/ratings/recent');
  const box = el('outRecent');
  if(!res.ok){ box.textContent = 'Fel vid hämtning.'; return; }
  const data = res.body;
  if(!data.ratings?.length){ box.textContent = 'Inga betyg ännu. Var först!'; return; }
  box.innerHTML = data.ratings.map(r=>{
    const proof = r.hasProof ? '✅ Verifierat underlag' : '—';
    const when = new Date(r.createdAt).toLocaleString();
    const who = r.raterMasked ? ` • av ${r.raterMasked}` : '';
    const comment = r.comment ? `<div>${r.comment}</div>` : '';
    return `<div class="rating-row">
      <strong>${r.subject}</strong> • ${r.rating}/5${who} • ${proof}<br>
      ${comment}<small>${when}</small>
    </div>`;
  }).join('');
}

el('btnSubmit').addEventListener('click', async (e)=>{
  e.preventDefault();
  setNotice('', '');
  const subject = el('subjectInput').value.trim();
  const rater   = el('raterInput').value.trim();
  const rating  = parseInt(el('ratingInput').value, 10);
  const comment = el('commentInput').value.trim();
  const proofRef= el('proofInput').value.trim();

  if(!subject){ setNotice('error','Fyll i vem du betygsätter.'); return; }
  if(!Number.isInteger(rating) || rating<1 || rating>5){
    setNotice('error','Betyg måste vara 1–5.'); return;
  }

  el('btnSubmit').disabled = true;
  show(el('spinner'));

  const res = await postJSON('/api/ratings', { subject, rater, rating, comment, proofRef });

  el('btnSubmit').disabled = false;
  hide(el('spinner'));

  if(res.ok && res.body?.ok){
    setNotice('success','Tack för ditt omdöme!');
    el('ratingInput').value = '';
    el('commentInput').value = '';
    el('proofInput').value = '';
    loadRecent();
  }else{
    const msg = res.body?.error || res.body?.details?.[0]?.message || 'Ogiltig inmatning';
    setNotice('error','Fel: ' + msg);
    console.warn('POST /api/ratings failed', res);
  }
});

el('btnShowAvg').addEventListener('click', async ()=>{
  const s = (el('avgSubject').value || el('subjectInput').value).trim();
  if(!s){ setNotice('error','Skriv en användare/mejl först.'); return; }
  const res = await getJSON(`/api/ratings/average?subject=${encodeURIComponent(s)}`);
  el('outAvg').textContent = res.ok && res.body?.ok
    ? `Snitt: ${res.body.average} (${res.body.count} betyg)`
    : (res.body?.error || 'Fel vid hämtning');
});

el('btnReload').addEventListener('click', loadRecent);
loadRecent();
