// Shared renderer for the v3 list mockups. Each page sets <body data-layout="2col|1col|3col|reg|table">.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LAYOUTS = [["1-two-col.html", "1 Two columns"], ["2-one-col.html", "2 One column"], ["3-three-col.html", "3 Three columns"],
  ["4-register.html", "4 Register"], ["5-table.html", "5 Table"], ["names.html", "Name styles"]];
const NAME_STYLES = [["a", "Medium"], ["b", "Bold"], ["c", "Heading face"], ["d", "Plum link"], ["e", "Bold + sector pill"]];
const WIDTHS = [["contained", "Contained 1120"], ["wide", "Wide 1440"], ["full", "Full width"]];

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const state = {q: "", org: ""};

function highlight(text, q) {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}
// Course row. Parts are spans so each name style and layout can restyle them.
function course([, name, sector, approved], q) {
  return `<a class="c" href="#"><span class="nm">${highlight(name, q)}</span><span class="mt"><span class="sec">${esc(sector)}</span>` +
    `<span class="dt">${approved ? "Approved " + approved : ""}</span></span></a>`;
}
// Search: an organisation match shows the whole organisation; otherwise course or sector matches show only those rows.
function visible() {
  const q = state.q.trim().toLowerCase();
  return COURSES.filter(c => {
    if (state.org && c[0] !== state.org) return false;
    if (!q) return true;
    return c[0].toLowerCase().includes(q) || c[1].toLowerCase().includes(q) || c[2].toLowerCase().includes(q);
  });
}
function groupByOrg(rows) {
  const groups = new Map();
  rows.forEach(c => groups.set(c[0], [...(groups.get(c[0]) || []), c]));
  return groups;
}
function render() {
  const q = state.q.trim();
  const rows = visible();
  const groups = groupByOrg(rows);
  const layout = document.body.dataset.layout;
  let html = "";
  if (!rows.length) html = '<p class="none">No standards match.</p>';
  else if (layout === "table") {
    html = '<table class="all"><thead><tr><th>Course</th><th>Organisation</th><th>Sector</th><th>Approved</th></tr></thead><tbody>' +
      rows.map(c => `<tr><td>${course(c, q)}</td><td class="o">${c[0]}</td><td class="s">${esc(c[2])}</td><td class="d">${c[3]}</td></tr>`).join("") + "</tbody></table>";
  } else if (layout === "reg") {
    html = [...groups].map(([org, list]) => `<section class="reg"><h2>${org} <span>${list.length} courses</span></h2>` +
      list.map(c => course(c, q).replace('class="c"', 'class="c row"')).join("") + "</section>").join("");
  } else {
    html = [...groups].map(([org, list]) => `<section class="card"><header><h2>${org}</h2><span class="badge">${list.length} ↓</span></header>` +
      `<ul class="courses">${list.map(c => "<li>" + course(c, q) + "</li>").join("")}</ul></section>`).join("");
  }
  $("#list").innerHTML = html;
  $(".count").textContent = `${rows.length} courses in ${groups.size} organisations`;
}
function renderRail() {
  const counts = new Map();
  COURSES.forEach(c => counts.set(c[0], (counts.get(c[0]) || 0) + 1));
  $("#rail").innerHTML = `<a href="#" data-org="" ${state.org ? "" : "aria-current=true"}>All organisations <span>${COURSES.length}</span></a>` +
    [...counts].map(([o, n]) => `<a href="#" data-org="${o}" ${state.org === o ? "aria-current=true" : ""}>${o} <span>${n}</span></a>`).join("");
  $$("#rail a").forEach(a => a.onclick = e => { e.preventDefault(); state.org = a.dataset.org; renderRail(); render(); });
}
function setVariant(key, value) {
  document.body.dataset[key] = value;
  localStorage["v3" + key] = value;
  $$(`[data-set="${key}"]`).forEach(b => b.setAttribute("aria-pressed", b.dataset.value === value));
}
function buildBar(withNames) {
  const here = location.pathname.split("/").pop();
  const group = (label, key, items) => `<span><b>${label}</b>` + items.map(([v, n]) => `<button data-set="${key}" data-value="${v}">${n}</button>`).join(" ") + "</span>";
  $("#mockbar").innerHTML = "<span><b>Layout</b>" + LAYOUTS.map(([f, n]) => `<a href="${f}" ${f === here ? "aria-current=page" : ""}>${n}</a>`).join(" ") + "</span>" +
    group("Width", "width", WIDTHS) + (withNames ? group("Course name", "name", NAME_STYLES) : "");
  $$("[data-set]").forEach(b => b.onclick = () => setVariant(b.dataset.set, b.dataset.value));
}
addEventListener("DOMContentLoaded", () => {
  const comparePage = document.body.dataset.page === "names"; // shows every name style at once, so no name switch
  buildBar(!comparePage);
  setVariant("width", localStorage.v3width || "contained");
  if (comparePage) return renderNames();
  setVariant("name", localStorage.v3name || "a");
  if ($("#list")) {
    renderRail();
    render();
    $("#q").oninput = e => { state.q = e.target.value; render(); };
  }
});

// Name-styles page: the same six courses once per style. Both long names and a course with no date are included.
function renderNames() {
  const picks = ["Computerised Sweater Machine Operation", "Welding", "Electrical Installation and Maintenance (Shipbuilding)",
    "Professional Digital Marketing", "Machine Shop Practice", "4G - 6G Welding"];
  const rows = picks.map(n => COURSES.find(c => c[1] === n));
  $("#list").innerHTML = NAME_STYLES.map(([key, label]) => `<section data-name="${key}"><h2 class="sample">${label}</h2>` +
    `<div class="card"><ul class="courses">${rows.map(c => "<li>" + course(c, key === "a" ? "weld" : "") + "</li>").join("")}</ul></div></section>`).join("");
}
