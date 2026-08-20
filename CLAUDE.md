# SICIP Standards Platform

A static site presenting Bangladesh SICIP **Competency Standards (CS)** and **Workshop/Lab Facility Standards** for 22 industry organisations, plus an in-page **facility score calculator**. Deploys to **Cloudflare Pages**. No backend.

## Token economy
- If `caveman` plugin/skill available: keep active (full). Terse output always.
- If `ponytail` plugin/skill available: keep active (full). Laziest working solution.
- Fallback (no plugins): terse replies, no filler; YAGNI, stdlib/native before dependencies, shortest working diff.

## Memory — MANDATORY
Maintain `DECISIONS.md` with five sections:
- **Current state** — living snapshot, edit in place.
- **Next** — in-flight work handoff, 3-5 bullets max, prune ruthlessly.
- **Gotchas** — living quirks (flaky tests, env vars, wrong docs), one line each.
- **Tried / rejected** — one line: what + why dead; never re-attempt anything listed.
- **Log** — append-only: `YYYY-MM-DD | decision | why`.

Read "Current state" + "Next" + "Gotchas" + "Tried / rejected" before any work.
Update in the same commit as the change it describes. Terse. If missing, create it with those five section headers.
Split of memory: CLAUDE.md = rules, DECISIONS.md = knowledge, git history = events. Don't duplicate across them.

## Commits
- Every feature/code change = one terse commit immediately. Conventional type prefix (feat/fix/docs/chore), subject ≤50 chars.
- NO AI trailers (no Co-Authored-By etc.) — repo carries no AI traces.
- DECISIONS.md IS committed (project knowledge, not sensitive).

## Style
- KISS, UNIX philosophy: one file/module = one job, keep files small.
- Terse comments per code block; reusable/templated code.
- Check current library docs before using an API.

## Parallelism
When tasks touch disjoint files, run multiple cost-efficient subagents IN PARALLEL (background). Serialize only true conflicts. For `soffice` docx→pdf conversions in parallel, give each a unique profile: `-env:UserInstallation=file:///tmp/lo_<id>` or they deadlock on a shared profile lock.

## Verification
Nothing is "done" until exercised for real: serve the site and drive the changed flow end-to-end in a browser (Playwright/Helium). Report failures verbatim. Clean up temp servers and screenshots.

## Secrets & confidentiality
- Credentials, keys, tokens: gitignored files only, never printed, never in history.
- Before any public push: audit HEAD and history for leaks.

---

# THE SITE — authoritative design spec

The mockups in `docs/mockups/` are **visual reference** (an early iteration). Where they differ from this spec, **this spec wins**. Screens verified in Helium during design.

## Stack & hosting
- **Pure static**: HTML + CSS + vanilla JS. No framework, no backend, no build step beyond generating `data/data.json` and gathering assets.
- **Cloudflare Pages** (free): 25 MB/file, 20k files, unlimited bandwidth. CS PDFs (~150 MB, all <15 MB) fit. GitHub Pages was rejected once CBLMs enter (1 GB cap).
- **Hash router** (`#/lab`, `#/cs`, `#/lab/<slug>`, `#/cs/<slug>`): every page is a shareable, bookmarkable URL with working back-button. (Mockup used bare show/hide — replace with the router.)

## Typography — FINAL
- **Headings / wordmark:** Space Grotesk. **Body / UI:** Spline Sans. (Font collection #3.)
- **Self-host** the woff2 files (offline-safe, faster, no Google CDN dependency). Do NOT use Public Sans / Inter / Source Serif (earlier iterations — rejected as templated).
- Comfortable sizing: body ~16.5px, headings 22–27px. Never cramped.

## Palette (committed light theme)
`--bg:#f3f4f2  --surface:#fff  --panel:#fafbf9  --ink:#17211c  --muted:#586158  --faint:#87908a  --line:#e4e7e3  --line-strong:#d3d8d2  --accent:#0e6b58  --accent-ink:#0a4f42  --accent-tint:#e4f1ec  --mark:#ffe294  --warn:#b4402f`
One teal accent (links, selection, primary buttons, highlight). No gradient text, no glassmorphism, no eyebrow kickers, no identical-card overload — no AI tells.

## Navigation
Two top tabs only: **Lab Standards** | **Competency Standards**. (There is NO separate "Score Calculator" tab — calculation lives inside each lab-standard page.)

## Lab Standards
- Landing = **searchable org directory** (cards, one per organisation). Search matches **course, sector, AND organisation**; course matches pinpoint+highlight the row, org matches show the whole org (same behaviour as `docs/reference-lab-index.html`).
- Subtitle line is just the counts (e.g. "22 organisations · 163 standards"). Do NOT add "open any to view, calculate a score, or print".
- **Org card count badge is a DOWNLOAD link** → that organisation's whole `.xlsx` workbook (from `lab-standards/`). Downloads ask for confirmation (see below).
- **Click a course → its lab-standard page**, which is template-faithful:
  - Title **"Course-wise Training Infrastructure and Facilities"**; then Course Name, Number of Trainees, Sector · Organisation, Approved date, Training Space block; then the boilerplate paragraph (80% rule etc.). Texts match the xlsx template exactly; table UI may be modernised.
  - Equipment table: `S.N. | Major equipment & facilities | Required | Available | Weight | Score`. **Available is an editable input defaulting to 0** on every row.
  - **Calculate button below the table.** Score formula per row = `MIN(available, required) * weight / required`; **Score/100** = `Σrow / Σweight * 100`; **Points/30** = `score * 30/100`; eligible when **≥ 80**.
  - **Print button** → prints the standard as the **exact xlsx template layout**, filled with the entered Available column (dedicated print stylesheet). Asks for confirmation.
  - **Download .xlsx** → serves that **course's single-sheet template file** (`data/xlsx/<slug>.xlsx`, generated by `scripts/split_sheets.py`), with the entered Available values written into column D client-side (`web/js/xlsx-fill.js`, native zip patch, no libs); unfilled rows stay blank. Asks for confirmation. (Whole-org workbook download stays on the directory card badge.)

## Competency Standards
- Same **searchable directory** layout as Lab Standards (course/sector/org).
- **Click a CS → its page** = official **PDF preview** (embedded `<iframe src=".../x.pdf">`; browser-native, text-selectable — CS PDFs have a real text layer). Buttons: **Download PDF**, **Print** (both confirm first). No "Open full" button.
- Prefer **PDF preview over HTML conversion** — fidelity + printability of the official document. Rejected pdf→html (mangles tables).

## Approval date
- Label **"Approved: DD Mon YYYY"**. Source = the date embedded in each CS **filename** (~90% parse; ~95% with underscore/apostrophe handling). For the **~8 with no filename date** (Masonry & Steel Binding ×3, Crane & Forklift, PKSF Graphic Design, PKSF Digital Marketing, BJMA Compliance), take the **date from the CS cover page**. Blank only if genuinely unknown.
- Caveat: filename date = version/finalization date; treat as the approval date unless an official approval-date list is supplied.

## Confirmations
**Every download and every print asks for confirmation first** (a small confirm dialog/modal — not the raw browser print with no warning).

## Responsive & a11y
- Desktop: multi-column card grid, full document width. Mobile: single column, key/value stacks label-over-value, wide equipment table scrolls horizontally, score cards stack, nav reachable.
- Body text ≥4.5:1 contrast; visible focus states; keyboard-navigable; `prefers-reduced-motion` honoured.

## Data model — `data/data.json`
Reconstruct from the workbooks + sectors + filename dates. One entry per course:
```
{ org, org_slug, course_name, sheet, sector|null, trainees, space,
  approved: "DD Mon YYYY"|null,
  equipment: [ { name, required, weight } , ... ],
  xlsx: "lab-standards/<ORG>-lab-standard.xlsx",
  cs_pdf: "competency-standards/<ORG>/<file>.pdf" | null }
```
- Lab-standard fields (course/trainees/space/equipment/weights) come from `lab-standards/*.xlsx` (read each sheet: B3 course, B4 trainees, C8 space, rows 16+ = name/required/weight until "Sum").
- Sector comes from `docs/reference-lab-index.html` (the "Sector: X" lines) — the authoritative sector map already extracted.
- Approved date parsed from the CS filename in `competency-standards/`.

## Repo layout
```
lab-standards/            22 org workbooks + 1 standalone (.xlsx), exact SICIP template
competency-standards/<ORG>/*.pdf   163 CS as PDFs (docx-only were converted), original filenames (carry the date)
data/                     data.json (generated) + xlsx/ per-course single-sheet files (generated)
web/                      the static site (to build)
docs/                     reference-lab-index.html, mockups/
scripts/                  build_lab_standard.py, dump_tail.py, dump_head.py (+ gen_index.py to re-add)
```

## Scope
- **Now:** Lab Standards + Competency Standards + in-page calculator, 163 records.
- **Deferred:** CBLMs (~420 docs, ~4.6 GB, some PDFs >25 MB). Would need PDF compression and/or **Cloudflare R2** (10 GB free, no egress, no per-file cap) — not GitHub/Pages-committable. Revisit later.

## Source of truth
Original SICIP documents live on the external drive: `.../FINAL CS SUBMISSION of SICIP/` (category folders `1) BMET` … `25) BSIA`). The drive remounts between `New Volume` and `New Volume1` — detect the live path. This repo is the curated, self-contained copy for the site.
