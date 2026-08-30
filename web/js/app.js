/* SICIP Standards — hash-router SPA over data/data.json */
'use strict';

let DATA = [];            // course entries
let ORGS = [];            // [{org, slug, courses:[entry]}] in source order
const searchQ = { lab: '', cs: '' };
const view = document.getElementById('view');

const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cSlug = e => e.org_slug.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '--' + slug(e.course_name);
const encPath = p => p.split('/').map(encodeURIComponent).join('/');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- confirm dialog ---------- */
const dlg = document.getElementById('confirm');
function confirmBox(msg) {
  return new Promise(res => {
    document.getElementById('confirm-msg').textContent = msg;
    const yes = document.getElementById('confirm-yes'), no = document.getElementById('confirm-no');
    const done = v => { dlg.close(); yes.onclick = no.onclick = dlg.oncancel = null; res(v); };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
    dlg.oncancel = e => { e.preventDefault(); done(false); };
    dlg.showModal();
  });
}

/* ---------- boot ---------- */
fetch('data/data.json')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => {
    DATA = d;
    const m = new Map();
    for (const e of d) {
      if (!m.has(e.org_slug)) m.set(e.org_slug, { org: e.org, slug: e.org_slug, courses: [] });
      m.get(e.org_slug).courses.push(e);
    }
    ORGS = [...m.values()];
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('hashchange', route);
    route();
  })
  .catch(err => { view.innerHTML = `<p class="status">Could not load data (${esc(err.message)}). Serve the site from the repository root.</p>`; });

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [kind, id] = h.split('/');
  document.querySelectorAll('.tabs a').forEach(a =>
    a.toggleAttribute && a.setAttribute('aria-current', a.dataset.tab === (kind || 'cs') ? 'page' : 'false'));
  if (kind === 'lab' && id) return labPage(id);
  if (kind === 'cs' && id) return csPage(id);
  if (kind === 'lab') return directory('lab');
  if (kind === 'cs' || !kind) { if (!kind) { location.replace('#/cs'); return; } return directory('cs'); }
  location.replace('#/cs');
}

const find = id => DATA.find(e => cSlug(e) === id);
const setTitle = t => { document.title = t ? t + ' — SICIP Standards' : 'SICIP Standards'; };

/* ---------- directory (shared by lab & cs) ---------- */
function directory(kind) {
  const isLab = kind === 'lab';
  const orgs = isLab ? ORGS : ORGS.map(o => ({ ...o, courses: o.courses.filter(c => c.cs_pdf) })).filter(o => o.courses.length);
  const total = orgs.reduce((n, o) => n + o.courses.length, 0);
  setTitle(isLab ? 'Lab Standards' : 'Competency Standards');

  view.innerHTML = `
  <div class="dir-head">
    <h1>${isLab ? 'Lab Standards' : 'Competency Standards'}</h1>
    <p class="dir-sub">${orgs.length} organisations · ${total} standards</p>
    <div class="search"><input id="q" type="search" autocomplete="off"
      placeholder="Search course, sector or organisation…" aria-label="Search"></div>
    <p class="count" id="count"></p>
  </div>
  <div class="grid" id="grid">
    ${orgs.map(o => `
    <section class="org" data-org="${esc((o.slug + ' ' + o.org).toLowerCase())}">
      <div class="org-hd">
        <span class="org-name">${esc(o.org)}</span>
        ${isLab
          ? `<a class="org-count" href="${encPath(o.courses[0].xlsx)}" download
               title="Download ${esc(o.org)} workbook (.xlsx)">${o.courses.length} ↓</a>`
          : `<span class="org-count">${o.courses.length}</span>`}
      </div>
      <ul class="course-list">
        ${o.courses.map(c => `
        <li class="course" data-course="${esc((c.course_name + ' ' + (c.sector || '')).toLowerCase())}">
          <a href="#/${kind}/${cSlug(c)}">
            <span class="c-name">${esc(c.course_name)}</span>
            <span class="c-full">${c.sector ? 'Sector: ' + esc(c.sector) : ''}</span>
          </a>
        </li>`).join('')}
      </ul>
    </section>`).join('')}
  </div>
  <p class="empty" id="empty">No matches.</p>`;

  // download confirmation on org badges
  if (isLab) view.querySelectorAll('a.org-count').forEach(a => {
    a.addEventListener('click', async e => {
      e.preventDefault();
      if (await confirmBox(`Download the ${a.closest('.org').querySelector('.org-name').textContent} lab-standard workbook (.xlsx)?`))
        location.href = a.href;
    });
  });

  // search — course match pinpoints rows, org match shows whole org
  const q = document.getElementById('q'), countEl = document.getElementById('count'), emptyEl = document.getElementById('empty');
  const sections = [...view.querySelectorAll('.org')];
  for (const c of view.querySelectorAll('.course')) {
    c._name = c.querySelector('.c-name').textContent;
    c._full = c.querySelector('.c-full').textContent;
  }
  const rxe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hl = (node, text, term) => {
    if (!term) { node.textContent = text; return; }
    node.innerHTML = esc(text).replace(new RegExp('(' + rxe(esc(term)) + ')', 'ig'), '<mark>$1</mark>');
  };
  function run() {
    const t = q.value.trim().toLowerCase();
    searchQ[kind] = q.value;
    let visibleOrgs = 0, hits = 0;
    for (const org of sections) {
      const courses = [...org.querySelectorAll('.course')];
      if (!t) {
        org.classList.remove('dim');
        courses.forEach(c => { c.classList.remove('off', 'hit'); hl(c.querySelector('.c-name'), c._name, ''); hl(c.querySelector('.c-full'), c._full, ''); });
        visibleOrgs++; continue;
      }
      const orgMatch = org.dataset.org.includes(t);
      let shown = 0;
      for (const c of courses) {
        const cMatch = c.dataset.course.includes(t);
        const nameEl = c.querySelector('.c-name'), fullEl = c.querySelector('.c-full');
        if (orgMatch) { c.classList.remove('off', 'hit'); hl(nameEl, c._name, ''); hl(fullEl, c._full, ''); shown++; }
        else if (cMatch) { c.classList.remove('off'); c.classList.add('hit'); hl(nameEl, c._name, t); hl(fullEl, c._full, t); shown++; hits++; }
        else { c.classList.add('off'); c.classList.remove('hit'); hl(nameEl, c._name, ''); hl(fullEl, c._full, ''); }
      }
      org.classList.toggle('dim', shown === 0);
      if (shown) visibleOrgs++;
    }
    emptyEl.classList.toggle('show', !!t && visibleOrgs === 0);
    countEl.innerHTML = !t || visibleOrgs === 0 ? '' :
      (hits ? `<b>${hits}</b> course${hits > 1 ? 's' : ''} in <b>${visibleOrgs}</b> organisation${visibleOrgs > 1 ? 's' : ''}`
            : `<b>${visibleOrgs}</b> organisation${visibleOrgs > 1 ? 's' : ''}`);
  }
  q.addEventListener('input', run);
  q.addEventListener('keydown', e => { if (e.key === 'Escape') { q.value = ''; run(); } });
  if (searchQ[kind]) { q.value = searchQ[kind]; run(); }
  window.scrollTo(0, 0);
}

/* ---------- lab standard page ---------- */
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('en', { maximumFractionDigits: 2 });

function labPage(id) {
  const e = find(id);
  if (!e) { view.innerHTML = '<p class="status">Standard not found. <a href="#/lab">Back to Lab Standards</a></p>'; return; }
  setTitle(e.course_name);
  const sumW = e.equipment.reduce((n, r) => n + (r.weight || 0), 0);

  view.innerHTML = `
  <a class="back" href="#/lab">← Lab Standards</a>
  <article class="doc">
    <h2 class="doc-title">Course-wise Training Infrastructure and Facilities</h2>
    <dl class="kv">
      <div><dt>Course Name</dt><dd>${esc(e.course_name)}</dd></div>
      <div><dt>Number of Trainees</dt><dd>${e.trainees}</dd></div>
      <div><dt>Sector · Organisation</dt><dd>${e.sector ? esc(e.sector) + ' · ' : ''}${esc(e.org)}</dd></div>
      ${e.approved ? `<div><dt>Approved</dt><dd>${esc(e.approved)}</dd></div>` : ''}
    </dl>
    <h3>Course-wise Training Space (Theoretical Classroom, Workshop/ Lab/ Classroom cum Workshop)</h3>
    <table class="space-tbl">
      <thead><tr><th>Course Name</th><th>SICIP required space for ${e.trainees} trainees</th></tr></thead>
      <tbody><tr><td>${esc(e.course_name)}</td><td class="pre">${esc(e.space)}</td></tr></tbody>
    </table>
    <h3>Major Training Equipment and Training Facilities</h3>
    <p class="boiler">${esc(e.boilerplate || '')}</p>
    <div class="tbl-scroll">
      <table class="equip" id="equip">
        <thead><tr>
          <th class="num">S.N.</th><th>Major equipment &amp; facilities</th>
          <th class="num">Required</th><th class="num">Available</th>
          <th class="num">Weight</th><th class="num">Score</th>
        </tr></thead>
        <tbody>
          ${e.equipment.map((r, i) => `
          <tr>
            <td class="sn">${i + 1}</td>
            <td>${esc(r.name)}${r.remark ? `<span class="rmk">${esc(r.remark)}</span>` : ''}</td>
            <td class="num">${r.required ?? ''}</td>
            <td class="num"><input type="number" min="0" step="any" value="0" data-i="${i}" inputmode="decimal" enterkeyhint="next"
                 aria-label="Available ${esc(r.name)}"></td>
            <td class="num">${r.weight}</td>
            <td class="num score" data-i="${i}">–</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td colspan="4">Sum</td><td class="num">${fmt(sumW)}</td><td class="num" id="sum-score">–</td>
        </tr></tfoot>
      </table>
    </div>
    <div class="actions">
      <button class="primary" id="calc">Calculate</button>
      <button id="print">Print</button>
      <button id="dl">Download .xlsx</button>
    </div>
    <div class="results" id="results" hidden>
      <div class="score-card" id="card-score"><div class="lbl">Score out of 100</div><div class="val">–</div></div>
      <div class="score-card" id="card-points"><div class="lbl">Total achieved points out of 30</div><div class="val">–</div></div>
      <div class="score-card" id="card-elig"><div class="lbl">Eligibility (≥ 80 required)</div><div class="val">–</div></div>
    </div>
  </article>`;

  // row score mirrors xlsx: IFERROR(MIN(C,D)*E/C, 0)
  const rowScore = (r, av) => {
    const req = Number(r.required);
    if (!req || req <= 0) return 0;
    return Math.min(av, req) * r.weight / req;
  };
  // mobile: select the 0 on focus so typing replaces it; Enter/Next jumps to the next row
  const inputs = [...view.querySelectorAll('.equip input')];
  inputs.forEach((inp, k) => {
    inp.addEventListener('focus', () => { if (inp.value === '0') inp.value = ''; });  // select() is unreliable on mobile number inputs
    inp.addEventListener('blur', () => { if (inp.value === '') inp.value = '0'; });
    inp.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      (inputs[k + 1] || document.getElementById('calc')).focus();
    });
  });
  const calc = () => {
    let sum = 0;
    view.querySelectorAll('.equip input').forEach(inp => {
      const i = +inp.dataset.i, av = Math.max(0, Number(inp.value) || 0);
      const s = rowScore(e.equipment[i], av);
      sum += s;
      view.querySelector(`.score[data-i="${i}"]`).textContent = fmt(s);
    });
    const score = sumW ? sum / sumW * 100 : 0, points = score * 30 / 100, ok = score >= 80;
    document.getElementById('sum-score').textContent = fmt(sum);
    const res = document.getElementById('results');
    res.hidden = false;
    const set = (id, v, cls) => { const c = document.getElementById(id); c.querySelector('.val').textContent = v; if (cls) c.className = 'score-card ' + cls; };
    set('card-score', fmt(score), ok ? 'ok' : 'no');
    set('card-points', fmt(points));
    set('card-elig', ok ? 'Eligible' : 'Not eligible', ok ? 'ok' : 'no');
    return { sum, score, points, ok };
  };
  document.getElementById('calc').addEventListener('click', calc);

  document.getElementById('dl').addEventListener('click', async () => {
    if (!await confirmBox(`Download the “${e.course_name}” lab standard?`)) return;
    const values = [...view.querySelectorAll('.equip input')].map(i => Math.max(0, Number(i.value) || 0));
    const url = 'data/xlsx/' + cSlug(e) + '.xlsx';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await xlsxFill(url, values));
    a.download = e.org_slug + ' - ' + e.course_name + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    if (a.href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  document.getElementById('print').addEventListener('click', async () => {
    if (!await confirmBox('Print this lab standard (official template layout, with your entered Available values)?')) return;
    const r = calc();
    printSheet(e, r);
  });
  window.scrollTo(0, 0);
}

/* print: rebuild the exact xlsx template layout into #print-sheet */
function printSheet(e, r) {
  const avail = [...view.querySelectorAll('.equip input')].map(i => Math.max(0, Number(i.value) || 0));
  const ps = document.getElementById('print-sheet');
  ps.innerHTML = `
    <h1>Course-wise Training Infrastructure and Facilities</h1>
    <p><b>Course Name:</b> ${esc(e.course_name)}</p>
    <p><b>Number of Trainees:</b> ${e.trainees}</p>
    <p class="sec">Course-wise Training Space (Theoretical Classroom, Workshop/ Lab/ Classroom cum Workshop)</p>
    <table>
      <tr><th>Course Name</th><th>SICIP required space for ${e.trainees} trainees</th></tr>
      <tr><td>${esc(e.course_name)}</td><td class="pre">${esc(e.space)}</td></tr>
    </table>
    <p class="sec">Major Training Equipment and Training Facilities</p>
    <p class="pre small">${esc(e.boilerplate || '')}</p>
    <table class="eq">
      <tr><th>S.N.</th><th>Major Equipment and Training facilities</th><th>Required facilities</th>
          <th>Available facilities</th><th>Weights<br>(out of 10)</th><th>Weighted scores</th><th>Remarks</th></tr>
      ${e.equipment.map((row, i) => {
        const req = Number(row.required);
        const s = !req || req <= 0 ? 0 : Math.min(avail[i], req) * row.weight / req;
        return `<tr><td class="c">${i + 1}</td><td>${esc(row.name)}</td><td class="c">${row.required ?? ''}</td>
          <td class="c">${avail[i]}</td><td class="c">${row.weight}</td><td class="c">${fmt(s)}</td>
          <td class="c">${row.remark ? esc(row.remark) : ''}</td></tr>`;
      }).join('')}
      <tr class="b"><td>Sum</td><td></td><td></td><td></td>
        <td class="c">${fmt(e.equipment.reduce((n, x) => n + (x.weight || 0), 0))}</td><td class="c">${fmt(r.sum)}</td><td></td></tr>
      <tr class="b"><td colspan="5">Score out of 100</td><td class="c">${fmt(r.score)}</td><td></td></tr>
      <tr class="b"><td colspan="5">Total achieved points out of 30</td><td class="c">${fmt(r.points)}</td><td></td></tr>
    </table>`;
  document.body.classList.add('printing-sheet');
  const cleanup = () => { document.body.classList.remove('printing-sheet'); ps.innerHTML = ''; };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}

/* self-hosted pdf.js viewer (web/pdfjs) — same UI in every browser; file path is relative to viewer.html */
const viewerUrl = rel => 'web/pdfjs/web/viewer.html?file=' + encodeURIComponent('../../../' + rel) + '#zoom=page-fit';

/* ---------- competency standard page ---------- */
function csPage(id) {
  const e = find(id);
  if (!e || !e.cs_pdf) { view.innerHTML = '<p class="status">Standard not found. <a href="#/cs">Back to Competency Standards</a></p>'; return; }
  setTitle(e.course_name);
  const pdf = encPath(e.cs_pdf);
  view.innerHTML = `
  <a class="back" href="#/cs">← Competency Standards</a>
  <h1 style="font-size:24px;margin:0">${esc(e.course_name)}</h1>
  <p class="cs-meta">
    <span>${e.sector ? esc(e.sector) + ' · ' : ''}${esc(e.org)}</span>
    ${e.approved ? `<span>Approved: ${esc(e.approved)}</span>` : ''}
  </p>
  <div class="actions" style="margin:0 0 14px">
    <button class="primary" id="dl-pdf">Download PDF</button>
    <button id="print-pdf">Print</button>
  </div>
  <iframe class="cs-frame" id="pdf-frame" src="${viewerUrl(e.cs_pdf)}" title="${esc(e.course_name)} — competency standard PDF"></iframe>`;
  // fill the rest of the viewport so the whole preview window is on screen
  const frame = document.getElementById('pdf-frame');
  const fit = () => { frame.style.height = Math.max(420, window.innerHeight - frame.getBoundingClientRect().top - 16) + 'px'; };
  fit(); window.addEventListener('resize', fit);

  document.getElementById('dl-pdf').addEventListener('click', async () => {
    if (!await confirmBox(`Download the competency standard PDF for “${e.course_name}”?`)) return;
    const a = document.createElement('a');
    a.href = pdf; a.download = e.cs_pdf.split('/').pop();
    document.body.appendChild(a); a.click(); a.remove();
  });
  document.getElementById('print-pdf').addEventListener('click', async () => {
    if (!await confirmBox(`Print the competency standard for “${e.course_name}”?`)) return;
    const f = document.getElementById('pdf-frame');
    try { f.contentWindow.focus(); f.contentWindow.print(); }
    catch { window.open(pdf, '_blank'); }
  });
  window.scrollTo(0, 0);
}
