# DECISIONS

## Current state
Site BUILT and verified locally (Playwright: search, calculator math, print sheet, confirms, CS iframe, mobile, all 162 slugs + asset URLs 200). Pure static: root `index.html` + `web/` (css/js/fonts, self-hosted Space Grotesk + Spline Sans variable woff2). Hash router `#/cs` (default, CS tab first per user) / `#/lab` / `#/{cs,lab}/<org>--<course>`. `data/data.json` = 162 entries (gen via `scripts/gen_data.py`; reads workbooks + reference index + `data/peer-data.json` for dates/pdf map). All 162 courses have cs_pdf; 8 approved=null (no date in filename OR cover — genuinely unknown); 5 sector=null (Beautification). Deploy root = repo root (asset paths `lab-standards/…`, `competency-standards/…` work as-is). NOT yet deployed to Cloudflare.

## Next
- BP similar-course analysis (Business-Plan/analysis/report.html + slides.html (gitignored, local only)): 3 orgs lack BPs (LFMEAB, BASIS, BSIA); BITAC covered by 2 scanned BPs (OCR), Short-course BP's 4 basic courses not in data.json; AEOSIB only via OCR (financial tables unreadable); Asia-TTC BP covers 3 courses. Get those BPs to fill blanks; regen = `python3 Business-Plan/analysis/pipeline/{groups,merge,gen,xlsx}.py` (xlsx = similar-courses.xlsx).
- Optional: `_headers` for cache control on pdfs/xlsx; custom domain.
- LATER — CBLMs (REMIND USER of this runbook when CBLMs come up): files >25MB, ~4.6GB → R2, NOT git/Pages. Steps: (1) dashboard: R2 → create bucket `sicip-cblm`; (2) bucket Settings → enable r2.dev public access (gives base URL); (3) drop files in local `cblm/` (already gitignored), bulk-upload via wrangler (`npx wrangler login` once); (4) add `cblm` URL field to data.json + Download CBLM button on course pages; push → Pages auto-deploys. R2 free: 10GB, zero egress.

## Gotchas
- `Business-Plan/` is gitignored (raw BP docs); extracted numbers + report live in `Business-Plan/analysis/` (also gitignored, NOT on GitHub). BP .doc→txt via soffice drops some tables (REHAB Table 3) — convert to html when a table looks empty; scanned PDFs need tesseract + eng.traineddata from tessdata_fast (system tessdata only has afr/osd).
- `pkill -f '<pattern>'` inside the Bash tool kills the tool's own shell if the pattern appears in its command line — use `kill <pid>`.
- External source drive remounts between `/run/media/rms/New Volume` and `New Volume1` — detect the live path before any file op; the /tmp scratchpad keyed to the old mount name gets wiped on remount (lost scripts/JSON once). Keep working files in-repo, not /tmp.
- Parallel `soffice` needs a unique `-env:UserInstallation=file:///tmp/lo_<id>` per instance or it deadlocks on the profile lock.
- Non-integer required qtys in some CS ("As required", "05 sets") → template builder coerces leading int, keeps original in Remarks; `F` cell wraps `IFERROR(...,0)`.
- 5 lab standards have no sector (all Beautification) — second line blank, not a fallback label.
- ISC-T&H workbook filename contains `&`; href must be URL-encoded. Mahila-Polytechnic file is hyphenated but displays "Mahila Polytechnic".
- Hash navigation: browser scroll restoration fires AFTER the hashchange handler — `history.scrollRestoration='manual'` required or detail pages open mid-scroll.
- 11 equipment rows have blank/non-numeric Required in the SOURCE workbooks (Mahila Cyber Security ×7 etc.) — row scores 0 like the xlsx IFERROR; not a bug.
- data.json regen: `python scripts/gen_data.py` (needs data/peer-data.json present); per-course xlsx regen: `python scripts/split_sheets.py` (needs data.json + workbooks).
- Official template scores a BLANK Available cell as full weight (Excel/LO MIN() ignores blanks), disagreeing with the page calculator (blank=0) — so downloads always write explicit 0 into every untouched D cell (parity verified page 3.11 == LO 3.1055…).
- Browsers heuristically cache css/js (http.server sends no cache headers) — bump `?v=N` in index.html whenever web/ assets change, or users get stale code.

## Tried / rejected
- pdf→HTML conversion for CS preview — mangles tables; use embedded PDF instead.
- Fonts Public Sans / Inter / Source Serif — read as AI-templated; chose Space Grotesk × Spline Sans (#3).
- Separate "Score Calculator" tab — folded into each lab-standard page.
- "Open full" button on CS preview — redundant with Download; removed.
- GitHub Pages for the full set incl. CBLMs — 1 GB cap; CBLMs deferred to R2.

## Log
2026-08-19 | scaffold repo, copy 23 workbooks + mockups + scripts | start of platform build
2026-08-19 | font = Space Grotesk × Spline Sans (#3) | user pick from 6-option mockup
2026-08-19 | approval date from filename, doc-cover for ~8 gaps, label "Approved" | user decision
2026-08-19 | CS = embedded PDF preview, no Open full; downloads/prints confirm first | user decision
2026-08-19 | Cloudflare Pages; CBLMs deferred | size fits CS (~150MB), CBLM ~4.6GB later
2026-08-19 | data.json via gen_data.py layered on peer-data.json | peer session extracted raw feed; gen adds boilerplate/remarks/date+pdf fixes
2026-08-19 | 8 dateless CS stay approved=null | no date in filename or first 3 PDF pages
2026-08-19 | CS tab first, #/cs is default landing | user request
2026-08-19 | site built: root index.html + web/, deploy root = repo root | asset paths resolve without copying 162MB of PDFs
2026-08-20 | lab-page Download = per-course sheet w/ filled Available; org badge keeps whole workbook | user request; split_sheets.py + client zip patch (xlsx-fill.js), no libs
2026-08-20 | GitHub = code only (history rewritten, documents gitignored), public; deploys = wrangler direct upload from local | user wants docs off GH; Pages git-integration impossible without assets
2026-08-20 | REVERSED: full repo (incl. documents) pushed to GitHub public | user: documents are public anyway; rewrite skipped, backup bundle kept
2026-08-20 | LIVE: https://sicip-standards.pages.dev (Pages git integration, auto-deploy on push) | production verified: 162 courses, calc, xlsx fill, pdf/font/workbook URLs 200
2026-08-25 | BP similar-course comparison: 33 groups, 118 courses; report, slides + pipeline kept in Business-Plan/analysis (gitignored, off GitHub) | user request; level never inferred, blanks kept blank
2026-08-30 | BITAC BPs (Short + Advanced, scanned) OCR'd + merged into BP analysis; Drone/illegible OCR figures left blank | user supplied BPs; no inference rule
2026-08-30 | BP report/slides revised: terse text, no narrative/Part 4/lab column, +hr/day, days/wk, classes/batch (stated only), level-shaded raw-material chart, Motor Driving BMET+DTE BP-only rows, Sweater Linking dropped | user review
2026-08-30 | Schedule fields re-checked in all 22 BPs (4 agents); stated-only in merge.py SCHED/COURSE_SCHED; added similar-courses.xlsx | user request
