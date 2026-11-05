// Fills every <el data-slot="..."> with the real lab-standard content and runs the score calculator.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const LAYOUTS = [["a-sheet.html", "A Sheet"], ["b-sidebar.html", "B Sidebar"], ["c-steps.html", "C Steps"], ["d-workbench.html", "D Workbench"]];
const VIEWS = [["desktop", "Desktop"], ["tablet", "Tablet 768"], ["phone", "Phone 390"]];

// Boilerplate: lines starting with a bullet are rules, the rest are paragraphs.
const lines = LAB.boilerplate.split("\n").map(s => s.trim()).filter(Boolean);
const rules = lines.filter(l => l.startsWith("•")).map(l => l.slice(1).trim());
const prose = lines.filter(l => !l.startsWith("•"));
// Training space: a trailing "OR" on a line starts the next option.
function spaceOptions() {
  const options = [[]];
  for (const raw of LAB.space.split("\n").map(s => s.trim()).filter(Boolean)) {
    const startsNext = /\s*\bOR$/i.test(raw);
    options.at(-1).push(raw.replace(/\s*\bOR$/i, ""));
    if (startsNext) options.push([]);
  }
  return options.filter(o => o.length);
}
const weightTotal = LAB.equipment.reduce((n, e) => n + e.weight, 0);

const slots = {
  head: () => `<h1>${esc(LAB.course_name)}</h1><p>Course-wise Training Infrastructure and Facilities</p>`,
  facts: () => `<dl class="facts"><div><dt>Organisation</dt><dd>${esc(LAB.org)}</dd></div><div><dt>Sector</dt><dd>${esc(LAB.sector)}</dd></div>` +
    `<div><dt>Number of trainees</dt><dd>${LAB.trainees}</dd></div><div><dt>Approved</dt><dd>${esc(LAB.approved)}</dd></div></dl>`,
  space: () => {
    const groups = spaceOptions().map(o => `<div class="opt">${o.map(l => `<span>${esc(l)}</span>`).join("")}</div>`);
    return `<section class="space"><h2 class="sec-h">Training space</h2>` +
      `<p class="intro">Theoretical classroom, workshop/lab, or classroom cum workshop — SICIP required space for ${LAB.trainees} trainees</p>` +
      `<div class="opts">${groups.join('<span class="or">or</span>')}</div></section>`;
  },
  conditions: () => `<section class="cond"><h2 class="sec-h">Conditions</h2><div class="cond-body">` +
    `<ul class="rules">${rules.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` +
    `<div class="prose">${prose.map(p => p.includes("at least 80%")
      ? `<p class="elig">${esc(p).replace("at least 80%", "<strong>at least 80%</strong>")}</p>` : `<p>${esc(p)}</p>`).join("")}</div></div></section>`,
  table: () => `<section class="equipment"><h2 class="sec-h">Major training equipment and facilities</h2>` +
    `<table class="eq"><thead><tr><th>S.N.</th><th>Major equipment &amp; facilities</th><th class="num">Required</th><th class="num">Available</th><th class="num">Weight</th><th class="num">Score</th></tr></thead>` +
    `<tbody>${LAB.equipment.map((e, i) => `<tr class="row"><td class="sn">${i + 1}</td><td class="name">${esc(e.name)}</td>` +
      `<td class="num rq" data-l="Required">${e.required}</td>` +
      `<td class="num av"><input type="number" min="0" value="0" inputmode="numeric" aria-label="Available: ${esc(e.name)}"></td>` +
      `<td class="num wt" data-l="Weight">${e.weight}</td><td class="num sc" data-l="Score"><span class="row-score">0</span></td></tr>`).join("")}</tbody>` +
    `<tfoot><tr><td></td><td>Sum</td><td></td><td></td><td class="num">${weightTotal}</td><td class="num"><span data-wsum>0</span></td></tr></tfoot></table>` +
    `<div class="eq-note"><span>Enter what the institute has in Available. The score updates as you type. Entries are saved in this browser.</span>` +
    `<button class="btn small" data-clear>Clear entries</button></div></section>`,
  score: () => `<div class="scorebox"><div class="sc-line"><span class="sc-n" data-score>0</span><span class="sc-of">/ 100</span><span data-status class="pill"></span></div>` +
    `<dl class="sc-rows"><dt>Points out of 30</dt><dd data-points>0</dd><dt>Weighted score</dt><dd><span data-wsum>0</span> / ${weightTotal}</dd></dl></div>`,
  actions: () => `<div class="actions"><button class="btn primary">Download .xlsx</button><button class="btn">Print</button></div>`,
};

// Row score = MIN(available, required) * weight / required; score = sum(rows) / sum(weights) * 100; eligible at 80 or more.
function calculate() {
  let sum = 0;
  const rows = $$(".equipment tbody tr");
  LAB.equipment.forEach((e, i) => {
    const available = Math.max(0, +rows[i].querySelector("input").value || 0);
    const row = Math.min(available, e.required) * e.weight / e.required;
    sum += row;
    rows[i].querySelector(".row-score").textContent = +row.toFixed(2);
  });
  const score = sum / weightTotal * 100;
  $$("[data-score]").forEach(n => n.textContent = +score.toFixed(2));
  $$("[data-points]").forEach(n => n.textContent = +(score * 0.3).toFixed(2));
  $$("[data-wsum]").forEach(n => n.textContent = +sum.toFixed(2));
  $$("[data-status]").forEach(n => { n.textContent = score >= 80 ? "Eligible" : "Below 80 — not eligible"; n.className = "pill " + (score >= 80 ? "good" : "bad"); });
}
const SAMPLE = [1, 1, 3, 1, 0, 1, 2, 2, 1, 1, 1, 1];
function fill(values) {
  $$(".equipment tbody input").forEach((input, i) => input.value = values[i]);
  calculate();
}
function setView(v) {
  document.body.dataset.view = v;
  $$("[data-view-set]").forEach(b => b.setAttribute("aria-pressed", b.dataset.viewSet === v));
}
function buildBar() {
  const here = location.pathname.split("/").pop();
  $("#mockbar").innerHTML = "<span><b>Layout</b>" + LAYOUTS.map(([f, n]) => `<a href="${f}" ${f === here ? "aria-current=page" : ""}>${n}</a>`).join(" ") + "</span>" +
    "<span><b>Screen</b>" + VIEWS.map(([v, n]) => `<button data-view-set="${v}">${n}</button>`).join(" ") + "</span>" +
    '<span><b>Entries</b><button data-fill="sample">Fill sample</button> <button data-fill="zero">Reset to 0</button></span>';
  $$("[data-view-set]").forEach(b => b.onclick = () => setView(b.dataset.viewSet));
  $$("[data-fill]").forEach(b => b.onclick = () => fill(b.dataset.fill === "sample" ? SAMPLE : SAMPLE.map(() => 0)));
}
addEventListener("DOMContentLoaded", () => {
  $$("[data-slot]").forEach(el => el.innerHTML = slots[el.dataset.slot]());
  $$(".equipment input").forEach(i => i.oninput = calculate);
  $$("[data-clear]").forEach(b => b.onclick = () => fill(SAMPLE.map(() => 0)));
  buildBar();
  setView("desktop");
  calculate();
});
