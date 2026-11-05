// Shared mock behaviour: toolbar, theme + screen switching, sample data, score calculator.
const SAMPLE = {
  orgs: [
    {org:"BMET", n:30, courses:[["Advanced Auto Mechanics","Transport","14 Sep 2025"],["Graphic and UI Design","ICT","14 Aug 2025"],["Hotel Housekeeping","Tourism & Hospitality","22 Apr 2025"]]},
    {org:"PKSF", n:13, courses:[["Bakery and Pastry Production","Tourism & Hospitality","23 Jul 2025"],["Food and Beverage Production","Tourism & Hospitality","23 Jul 2025"],["Professional Digital Marketing","ICT",""]]},
    {org:"BGMEA", n:12, courses:[["Sewing Machine Operation (Lingerie)","RMG","28 May 2025"],["Sweater Linking Operation","RMG","07 Jul 2025"],["Computerised Sweater Machine Operation","RMG","07 Jul 2025"]]},
    {org:"DTE", n:10, courses:[["Welding","Light Engineering","16 Jul 2025"],["Sewing Machine Operation","RMG","20 Oct 2025"],["4G - 6G Welding","Shipbuilding","14 Sep 2025"]]},
    {org:"BEIOA", n:7, courses:[["Machine Shop Practice","Light Engineering","03 Jul 2025"]]},
  ],
  sectors:["Construction","ICT","Light Engineering","RMG","Shipbuilding","Tourism & Hospitality","Transport"],
  course:{org:"BEIOA",name:"Machine Shop Practice",sector:"Light Engineering",trainees:25,approved:"03 Jul 2025",
    space:"Classroom: 350 sft · Workshop/Lab: 800–1000 sft",
    // [name, required, weight, demo available]
    eq:[["Lathe Machine",10,10,10],["Shaper Machine",1,8,1],["Milling Machine",1,9,1],["Drill Machine",2,7,2],["Bench Vice",8,6,6],
        ["Surface Grinding Machine",2,8,1],["Power hacksaw",1,6,1],["Cut off saw",1,6,0],["Working Table",5,4,5]]},
};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

const THEMES = [["kiln","Kiln"],["plum","Plum"],["graphite","Graphite"],["monsoon","Monsoon"],["paddy","Paddy"]];
const LAYOUTS = [["a-register.html","A Register"],["b-rail.html","B Rail"],["c-concourse.html","C Concourse"],["d-split.html","D Split"]];
const SCREENS = [["dir","Directory"],["lab","Lab page"],["cs","CS page"]];

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.mockTheme = t;
  $$("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeSet === t));
}
function showScreen(s) {
  $$("[data-screen]").forEach(e => e.hidden = e.dataset.screen !== s);
  $$("[data-go]").forEach(b => b.setAttribute("aria-pressed", b.dataset.go === s));
  document.body.dataset.now = s; // lets a layout style by current screen
  history.replaceState(null, "", "#" + s);
  scrollTo(0, 0);
}
function buildBar() {
  const here = location.pathname.split("/").pop();
  $("#mockbar").innerHTML =
    "<span><b>Layout</b>" + LAYOUTS.map(([f, n]) => `<a href="${f}" ${f === here ? "aria-current=page" : ""}>${n}</a>`).join(" ") + "</span>" +
    "<span><b>Screen</b>" + SCREENS.map(([k, n]) => `<button data-go="${k}">${n}</button>`).join(" ") + "</span>" +
    "<span><b>Colour</b>" + THEMES.map(([k, n]) => `<button data-theme-set="${k}">${n}</button>`).join(" ") + "</span>";
  $$("[data-go]").forEach(b => b.onclick = () => showScreen(b.dataset.go));
  $$("[data-theme-set]").forEach(b => b.onclick = () => setTheme(b.dataset.themeSet));
}

// Equipment rows + calculator: row = MIN(avail, req) * weight / req; score = sum(row) / sum(weight) * 100; eligible >= 80
function buildEquipment() {
  const rows = SAMPLE.course.eq.map(([name, req, w, demo], i) =>
    `<tr><td>${i + 1}</td><td>${name}</td><td class="num">${req}</td>` +
    `<td class="num"><input class="avail" type="number" min="0" value="${demo}" aria-label="Available: ${name}"></td>` +
    `<td class="num">${w}</td><td class="num row-score">0.0</td></tr>`).join("");
  $$("[data-eq]").forEach(t => t.innerHTML = rows);
  $$(".avail").forEach(i => i.oninput = calculate);
  calculate();
}
function calculate() {
  const avail = $("[data-eq]").querySelectorAll(".avail");
  let sum = 0, weights = 0;
  SAMPLE.course.eq.forEach(([, req, w], i) => {
    const row = Math.min(+avail[i].value || 0, req) * w / req;
    sum += row; weights += w;
    $$("[data-eq]").forEach(t => t.rows[i].querySelector(".row-score").textContent = row.toFixed(1));
  });
  const score = sum / weights * 100;
  $$("[data-score]").forEach(e => e.textContent = score.toFixed(1));
  $$("[data-points]").forEach(e => e.textContent = (score * 0.3).toFixed(1));
  $$("[data-status]").forEach(e => {
    e.textContent = score >= 80 ? "Eligible" : "Below 80";
    e.className = "pill " + (score >= 80 ? "good" : "bad");
  });
}
addEventListener("DOMContentLoaded", () => {
  buildBar();
  buildEquipment();
  setTheme(localStorage.mockTheme || "kiln");
  const first = location.hash.slice(1);
  showScreen(["dir", "lab", "cs"].includes(first) ? first : "dir");
});
