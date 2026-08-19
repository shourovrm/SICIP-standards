# DECISIONS

## Current state
Repo scaffolded + assets in. `lab-standards/` = 23 workbooks (22 orgs + standalone Weaving), exact SICIP template, live formulas. `competency-standards/<ORG>/` = **162 CS PDFs** across 22 orgs (docx-only converted via soffice; original filenames keep the date), 0 zero-byte, 162 MB, none >25 MB (Cloudflare-safe). 162 not 163 = BPI "Electrical Works V2" is a duplicate of the revised Electrical Works (dropped as a CS; the lab workbook still has both sheets — reconcile in data.json). `docs/mockups/` = site + font mockups; `docs/reference-lab-index.html` carries the sector map. `scripts/` = build_lab_standard.py + dump_tail/head.py. Site (`web/`, `data/data.json`) NOT built yet.

## Next
- Reconstruct `data/data.json` from workbooks + sectors (reference index) + filename dates.
- Rebuild `gen_index.py` (lost in a scratchpad wipe) — logic is in CLAUDE.md/site spec.
- Build the static site in `web/` per the CLAUDE.md design spec (router, font #3, calculator, PDF preview, confirmations, print CSS).
- Wire Cloudflare Pages deploy.

## Gotchas
- External source drive remounts between `/run/media/rms/New Volume` and `New Volume1` — detect the live path before any file op; the /tmp scratchpad keyed to the old mount name gets wiped on remount (lost scripts/JSON once). Keep working files in-repo, not /tmp.
- Parallel `soffice` needs a unique `-env:UserInstallation=file:///tmp/lo_<id>` per instance or it deadlocks on the profile lock.
- Non-integer required qtys in some CS ("As required", "05 sets") → template builder coerces leading int, keeps original in Remarks; `F` cell wraps `IFERROR(...,0)`.
- 5 lab standards have no sector (all Beautification) — second line blank, not a fallback label.
- ISC-T&H workbook filename contains `&`; href must be URL-encoded. Mahila-Polytechnic file is hyphenated but displays "Mahila Polytechnic".

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
