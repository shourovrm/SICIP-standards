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

/* ---------- CS org zip: fetch every PDF, pack client-side ---------- */
async function downloadOrgPdfs(org, badge) {
  // a PDF shared by two courses would otherwise appear twice in the zip
  const paths = [...new Set(org.courses.map(c => c.cs_pdf))];
  const label = badge.textContent;
  badge.textContent = '…';
  badge.setAttribute('aria-busy', 'true');
  try {
    const entries = await Promise.all(paths.map(async p => {
      const res = await fetch(encPath(p));
      if (!res.ok) throw new Error(`${res.status} ${p}`);
      return { name: p.split('/').pop(), data: new Uint8Array(await res.arrayBuffer()) };
    }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipStore(entries, 'application/zip'));
    a.download = org.slug + '-competency-standards.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch (err) {
    alert('Download failed: ' + err.message);
  } finally {
    badge.textContent = label;
    badge.removeAttribute('aria-busy');
  }
}

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
          : `<a class="org-count" href="#" role="button" data-slug="${esc(o.slug)}"
               title="Download all ${esc(o.org)} competency standards (.zip)">${o.courses.length} ↓</a>`}
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
  view.querySelectorAll('a.org-count').forEach(a => {
    a.addEventListener('click', async e => {
      e.preventDefault();
      const orgName = a.closest('.org').querySelector('.org-name').textContent;
      if (isLab) {
        if (await confirmBox(`Download the ${orgName} lab-standard workbook (.xlsx)?`)) location.href = a.href;
        return;
      }
      const org = orgs.find(o => o.slug === a.dataset.slug);
      if (await confirmBox(`Download all ${org.courses.length} ${orgName} competency standards (.zip)?`))
        downloadOrgPdfs(org, a);
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

  // boilerplate text exact; "•" lines become list items, the rest paragraphs
  const rules = (() => {
    const lines = (e.boilerplate || '').split('\n').map(l => l.trim()).filter(Boolean);
    const li = lines.filter(l => l.startsWith('•')).map(l => `<li>${esc(l.slice(1).trim())}</li>`).join('');
    const ps = lines.filter(l => !l.startsWith('•'))
      .map(l => `<p>${esc(l).replace('at least 80%', '<strong>at least 80%</strong>')}</p>`).join('');
    return (li ? `<ul>${li}</ul>` : '') + ps
      + (e.note ? `<p class="note">${esc(e.note)}</p>` : '');
  })();
  const space = esc((e.space || '').split('\n').map(l => l.trim()).filter(Boolean).join('\n'));

  view.innerHTML = `
  <a class="back" href="#/lab">← Lab Standards</a>
  <div class="lab">
    <aside class="lab-side">
      <div class="card">
        <p class="docname">Course-wise Training Infrastructure and Facilities</p>
        <h1 class="course-h">${esc(e.course_name)}</h1>
        <dl class="facts">
          <div><dt>Organisation</dt><dd>${esc(e.org)}${e.sector ? ' · ' + esc(e.sector) : ''}</dd></div>
          <div><dt>Number of Trainees</dt><dd>${e.trainees}</dd></div>
          ${e.approved ? `<div><dt>Approved</dt><dd>${esc(e.approved)}</dd></div>` : ''}
        </dl>
      </div>
      <div class="card">
        <h3 class="side-h">Training space</h3>
        <p class="hint">Theoretical classroom, workshop/lab, or classroom cum workshop — SICIP required space for ${e.trainees} trainees</p>
        <p class="pre space">${space}</p>
      </div>
      <div class="card live">
        <h3 class="side-h">Facility score</h3>
        <div class="n"><span id="s100">0</span><small> / 100</small></div>
        <span class="pill no" id="elig">Below 80 — not eligible</span>
        <div class="row"><span>Points out of 30</span><b id="s30">0</b></div>
        <div class="row"><span>Weighted score</span><b><span id="sum-score">0</span> / ${fmt(sumW)}</b></div>
        ${e.note && !e.min_rules.length ? `<label class="ac"><input type="checkbox" id="ac" checked> Lab is air-conditioned</label>` : ''}
        ${e.note ? `<p class="ac-hint" id="ac-hint" hidden></p>` : ''}
        <div class="actions">
          <button class="primary" id="dl">Download .xlsx</button>
          <button id="print">Print</button>
        </div>
      </div>
    </aside>
    <div class="lab-main">
      <div class="card"><div class="rules">
        <h2 class="sec">Conditions</h2>
        ${rules}
      </div></div>
      <div class="card">
        <h2 class="sec">Major training equipment and facilities <small>Enter what the institute has in <em>Available</em> — the score updates as you type.</small></h2>
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
                <td class="num score" data-i="${i}">0</td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr>
              <td colspan="4">Sum</td><td class="num">${fmt(sumW)}</td><td class="num" id="sum-w-score">0</td>
            </tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  </div>`;

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
    inp.addEventListener('input', () => calc());
    inp.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      (inputs[k + 1] || document.getElementById('dl')).focus();
    });
  });
  const acBox = document.getElementById('ac');
  if (acBox) acBox.addEventListener('change', () => calc());
  const calc = () => {
    let sum = 0;
    view.querySelectorAll('.equip input').forEach(inp => {
      const i = +inp.dataset.i, av = Math.max(0, Number(inp.value) || 0);
      const s = rowScore(e.equipment[i], av);
      sum += s;
      view.querySelector(`.score[data-i="${i}"]`).textContent = fmt(s);
    });
    const score = sumW ? sum / sumW * 100 : 0, ok = score >= 80;
    // CS footnote halves the points: lab not air-conditioned, or fewer than the minimum of key items (e.g. welding booths)
    const ac = document.getElementById('ac');
    const unmet = e.min_rules.filter(r => (Number(view.querySelector(`.equip input[data-i="${r.row}"]`).value) || 0) < r.min);
    const halved = unmet.length > 0 || (!!ac && !ac.checked);
    const why = unmet.length ? 'fewer than ' + unmet.map(r => `${r.min} ${r.item}`).join(' and ') : 'lab not air-conditioned';
    const points = halved ? score * 30 / 100 / 2 : score * 30 / 100;
    const hint = document.getElementById('ac-hint');
    if (hint) { hint.hidden = !halved; hint.textContent = `${why[0].toUpperCase()}${why.slice(1)} — points halved.`; }
    document.getElementById('sum-score').textContent = fmt(sum);
    document.getElementById('sum-w-score').textContent = fmt(sum);
    document.getElementById('s100').textContent = fmt(score);
    document.getElementById('s30').textContent = fmt(points);
    const el = document.getElementById('elig');
    el.className = 'pill ' + (ok ? 'ok' : 'no');
    el.textContent = ok ? 'Eligible' : 'Below 80 — not eligible';
    return { sum, score, points, ok, halved, why };
  };

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
      <tr class="b"><td colspan="5">Total achieved points out of 30${r.halved ? ` (halved — ${r.why})` : ''}</td><td class="c">${fmt(r.points)}</td><td></td></tr>
    </table>
    ${e.note ? `<p class="small">${esc(e.note)}</p>` : ''}`;
  document.body.classList.add('printing-sheet');
  const cleanup = () => { document.body.classList.remove('printing-sheet'); ps.innerHTML = ''; };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}

/* self-hosted pdf.js viewer (web/pdfjs) — same UI in every browser; file path is relative to viewer.html */
const viewerUrl = rel => 'web/pdfjs/web/viewer.html?file=' + encodeURIComponent('../../../' + rel) + '#zoom=page-fit'
  + (matchMedia('(max-width: 900px)').matches ? '&pagemode=none' : '&pagemode=outline');  // phones: outline sidebar would cover the page

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
