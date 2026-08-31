# DECISIONS

## Current state
Site BUILT and verified locally (Playwright: search, calculator math, print sheet, confirms, CS iframe, mobile, all 162 slugs + asset URLs 200). Pure static: root `index.html` + `web/` (css/js/fonts, self-hosted Space Grotesk + Spline Sans variable woff2). Hash router `#/cs` (default, CS tab first per user) / `#/lab` / `#/{cs,lab}/<org>--<course>`. `data/data.json` = 162 entries (gen via `scripts/gen_data.py`; reads workbooks + reference index + `data/peer-data.json` for dates/pdf map). All 162 courses have cs_pdf; 8 approved=null (no date in filename OR cover — genuinely unknown); 5 sector=null (Beautification). Deploy root = repo root (asset paths `lab-standards/…`, `competency-standards/…` work as-is). NOT yet deployed to Cloudflare.

## Next
- BP similar-course analysis (Business-Plan/analysis/Similar-Course-Analysis-{report,slides}.html + Similar-Course-Analysis.xlsx (gitignored, local only)): 3 orgs lack BPs (LFMEAB, BASIS, BSIA); BITAC covered by 2 scanned BPs (OCR), Short-course BP's 4 basic courses not in data.json; AEOSIB only via OCR (financial tables unreadable); Asia-TTC BP covers 3 courses. Get those BPs to fill blanks; regen = `python3 Business-Plan/analysis/pipeline/{groups,merge,gen,xlsx}.py` (xlsx = Similar-Course-Analysis.xlsx).
- Optional: `_headers` for cache control on pdfs/xlsx; custom domain.
- LATER — CBLMs (REMIND USER of this runbook when CBLMs come up): files >25MB, ~4.6GB → R2, NOT git/Pages. Steps: (1) dashboard: R2 → create bucket `sicip-cblm`; (2) bucket Settings → enable r2.dev public access (gives base URL); (3) drop files in local `cblm/` (already gitignored), bulk-upload via wrangler (`npx wrangler login` once); (4) add `cblm` URL field to data.json + Download CBLM button on course pages; push → Pages auto-deploys. R2 free: 10GB, zero egress.

## Gotchas
- `Business-Plan/` is gitignored (raw BP docs); extracted numbers + report live in `Business-Plan/analysis/` (also gitignored, NOT on GitHub). BP .doc→txt via soffice drops some tables (REHAB Table 3) — convert to html when a table looks empty; scanned PDFs need tesseract + eng.traineddata from tessdata_fast (system tessdata only has afr/osd) — kept at `Business-Plan/analysis/pipeline/ocr_aeosib/tessdata/` (`TESSDATA_PREFIX=<that dir>`). All 25 BP texts (soffice/pdftotext/OCR) now persist at `Business-Plan/analysis/pipeline/bp_txt/<ORG>.txt` (+ `levels_review_N.json`, `TASK.md`) — reuse, don't reconvert. AEOSIB financial tables (pp.39–48) are landscape scans: `pdftoppm -r 250` + `magick -rotate 90` before OCR, else garbage.
- `pkill -f '<pattern>'` / `kill $(pgrep -f …)` inside the Bash tool kills the tool's own shell if the pattern appears ANYWHERE in the same command line (even in a later `sed … file.py`) — run the kill alone.
- Tesseract in parallel: set `OMP_THREAD_LIMIT=1` per process or 5 jobs oversubscribe and run ~6× slower. Rotation heuristic (dictionary-token share) false-positives on ToC/Bengali pages — verify with `tesseract img - --psm 0` (OSD; `osd.traineddata` copied into `ocr_aeosib/tessdata/`).
- LibreOffice XHTML export quirks (Business-Plan/html/build_html.py): self-closing `<div/>`/`<p/>`/`<a id/>`/`<colgroup/>` placeholders — `<div/>` stays open in HTML5 and swallows the rest; `<a id>` wraps whole paragraphs (teal text); a regex like `<colgroup[^>]*>.*?</colgroup>` over-matches on `<colgroup/>`.
- External source drive remounts between `/run/media/rms/New Volume` and `New Volume1` — detect the live path before any file op; the /tmp scratchpad keyed to the old mount name gets wiped on remount (lost scripts/JSON once). Keep working files in-repo, not /tmp.
- Parallel `soffice` needs a unique `-env:UserInstallation=file:///tmp/lo_<id>` per instance or it deadlocks on the profile lock.
- Non-integer required qtys in some CS ("As required", "05 sets") → template builder coerces leading int, keeps original in Remarks; `F` cell wraps `IFERROR(...,0)`.
- 5 lab standards have no sector (all Beautification) — second line blank, not a fallback label.
- ISC-T&H workbook filename contains `&`; href must be URL-encoded. Mahila-Polytechnic file is hyphenated but displays "Mahila Polytechnic".
- Hash navigation: browser scroll restoration fires AFTER the hashchange handler — `history.scrollRestoration='manual'` required or detail pages open mid-scroll.
- 11 equipment rows have blank/non-numeric Required in the SOURCE workbooks (Mahila Cyber Security ×7 etc.) — row scores 0 like the xlsx IFERROR; not a bug.
- data.json regen: `python scripts/gen_data.py` (needs data/peer-data.json present); per-course xlsx regen: `python scripts/split_sheets.py` (needs data.json + workbooks).
- Official template scores a BLANK Available cell as full weight (Excel/LO MIN() ignores blanks) — so ALL D cells hold explicit 0: source workbooks (`lab-standards/`, builder writes 0), per-course xlsx, and client fill (regex handles existing `<v>`). Org badge download was 30/30 until 2026-08-31.
- CS preview = self-hosted pdf.js 6.3 (`web/pdfjs/`, 8.3 MB: pruned to en-US locale, no .map/sample/debugger; draw/annotation tools hidden via a rule appended to viewer.css — viewer.html has a CSP that blocks inline styles; `viewer.css?v=N` must be bumped when that file changes). Iframe src = `viewer.html?file=../../../<cs_pdf>#zoom=page-fit`.
- CS page iframe height is set by JS to the remaining viewport (`fit()` on load/resize) so the whole preview window is on screen; a fixed vh cut the bottom off.
- Available inputs: `select()` is unreliable on mobile number inputs — a "0" is cleared on focus and restored on blur; Enter/Next jumps to the next row.
- Updating a CS: replace PDF, edit `data/peer-data.json` (cs_pdf + approved), rebuild the workbook sheet with `scripts/build_lab_standard.build_sheet`, then `gen_data.py` + `split_sheets.py` (revert the 161 untouched per-course xlsx — they only change timestamps).
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
2026-08-25 | BP similar-course comparison: 33 groups, 118 courses; report, slides + pipeline kept in Business-Plan/analysis (gitignored, off GitHub) | user request; levels: BP-stated + user-assigned in pipeline/levels.json (Mahila all Advanced)
2026-08-30 | BITAC BPs (Short + Advanced, scanned) OCR'd + merged into BP analysis; Drone/illegible OCR figures left blank | user supplied BPs; no inference rule
2026-08-30 | BP report/slides revised: terse text, no narrative/Part 4/lab column, +hr/day, days/wk, classes/batch (stated only), level-shaded raw-material chart, Motor Driving BMET+DTE BP-only rows, Sweater Linking dropped | user review
2026-08-30 | Schedule fields re-checked in all 22 BPs (4 agents); stated-only in merge.py SCHED/COURSE_SCHED; added similar-courses.xlsx | user request
2026-08-30 | Course levels now user-assigned (levels.json from xlsx edits) — overrides BP-stated; report/slides header + Part 1/2 trimmed | user request
2026-08-30 | Trainer-pay chart (paired bars per role, monthly; hourly/daily as text row) beside raw-material chart in report + slides | user picked option A
2026-08-30 | BWCCI Fashion Design CS replaced by 29 Apr 2026 (Revised) docx→pdf; lab standard rebuilt from its Workshop/Lab Facility Standard (19 items); new-item weights by analogy with other orgs' sheets | user supplied revised CS
2026-08-30 | Mobile fixes: no PDF iframe where no inline viewer; Available inputs clear 0 on focus, Enter = next | user reports from phone
2026-08-30 | Reverted mobile PDF placeholder (auto-download was a Firefox-mobile quirk, Chrome fine); CS iframe now sized to remaining viewport | user
2026-08-30 | CS preview switched from browser PDF plugin to self-hosted pdf.js viewer (same UI everywhere, visible scrollbar, page-fit on open, no draw tools) | Chrome plugin showed part of a page + overlay-only scrollbar; Firefox mobile auto-downloaded
2026-08-31 | AEOSIB raw material + trainer pay recovered from rotated Table 23.2 (p.40); chart hours/level sub-label was 18px via `.group .sub` clash — now `.bars text.sub` 9px, label 17px; BP: subtitle dropped from course tables | user request
2026-08-31 | BP chart labels: org always bold; course on 2nd line when org has several courses in a group (clab/lab_svg); label 16px, sub 12px; course cut 27 report / 24 slides | user picked mockup D; 17px one-line labels overflowed
2026-08-31 | AEOSIB Electrical (Shipbuilding) level Basic→Mid in levels.json | BP states Mid Level Course (p.40 pay = Mid rate)
2026-08-31 | Course levels re-reviewed from BP source text (5 agents, bp_txt/levels_review_*.json): 52 explicit matches, 0 wrong, 2 non-binary (DTE Welding 'Level-1,2,3,4', BITAC Ind. Electrical 'Basic to Advanced'), 62 not stated in BP (BMET, BEIOA, REHAB, DTE, PKSF, Asia-TTC, BRTC = user-assigned); BMET Electrical (Industry) BP-row mismatch fixed (raw 5,000→6,000) | user distrusts old JSON
2026-08-31 | Business-Plan/html/: all 25 BPs as mobile HTML (index.html; Word→LibreOffice XHTML stripped to semantic tags; scanned/PDF → 120dpi page image per page + collapsible OCR text, auto-rotated). QA by 5 agents: 1,468 tables cell-identical to source, 411 pages verified; 3 builder bugs + 13 rotation markers fixed | user request
2026-08-31 | Available (D) = explicit 0 in all 23 org workbooks + builder + per-course xlsx; fill regex replaces existing <v> | org workbook download showed 30/30 (blank D = full weight)
