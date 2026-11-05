#!/usr/bin/env python3
"""Build data/data.json from lab-standards/*.xlsx + docs/reference-lab-index.html.
Uses data/peer-data.json (another session's extraction) for approved-date and
cs_pdf matching (already fuzzy-resolved there); re-derives sector, course list,
and equipment/boilerplate fresh from the authoritative sources per CLAUDE.md.
"""

import html
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
LAB_DIR = ROOT / "lab-standards"
CS_DIR = ROOT / "competency-standards"
INDEX_HTML = ROOT / "docs" / "reference-lab-index.html"
PEER = ROOT / "data" / "peer-data.json"
OUT = ROOT / "data" / "data.json"

MONTH_NAMES = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
]
MONTHS_FULL = {name: i for i, name in enumerate(MONTH_NAMES, 1)}
MONTHS = {name[:3]: i for i, name in enumerate(MONTH_NAMES, 1)}

EXPECTED_ENTRIES = 171
MIN_TOKEN_LENGTH = 4  # shorter words are too common to identify a course
PDF_MATCH_THRESHOLD = 0.6  # share of significant course-name words found in a PDF name
TWO_DIGIT_YEAR_LIMIT = 100  # a year below this is written 'yy' and means 20yy


@dataclass
class Course:
    org: str
    org_slug: str
    name: str
    sector: str | None


def norm(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# ---------- 1. parse reference-lab-index.html (authoritative course list) ----------


def parse_index():
    raw = INDEX_HTML.read_text(encoding="utf-8")
    orgs = []
    for sec in re.finditer(r'<section class="org".*?</section>', raw, re.S):
        block = sec.group()
        org_name = html.unescape(re.search(r'class="org-name"[^>]*>([^<]*)<', block).group(1))
        href = re.search(r'class="org-name" href="\./([^"]+)-lab-standard\.xlsx"', block).group(1)
        org_slug = re.sub(r"%26", "&", href)
        courses = []
        for li in re.finditer(
            r'<span class="c-name">([^<]*)</span><span class="c-full">([^<]*)</span>', block
        ):
            cname = html.unescape(li.group(1))
            full = html.unescape(li.group(2))
            sm = re.match(r"Sector:\s*(.+)", full)
            sector = sm.group(1).strip() if sm else None
            courses.append((cname, sector))
        orgs.append((org_name, org_slug, courses))
    return orgs


# ---------- 2. xlsx sheet lookup: find sheet whose B3 matches course name ----------


def find_sheet(wb, course_name):
    target = norm(course_name)
    candidates = []
    for name in wb.sheetnames:
        ws = wb[name]
        b3 = ws["B3"].value or ""
        if norm(b3) == target:
            candidates.append(name)
    if candidates:
        # BPI-style dup: prefer sheet with higher revision marker in name
        if len(candidates) > 1:
            candidates.sort(key=lambda n: "v2" in n.lower() or "revised" in n.lower())
            return candidates[-1]
        return candidates[0]
    # fallback: fuzzy sheet-name match
    for name in wb.sheetnames:
        if norm(name) == target or target in norm(name) or norm(name) in target:
            return name
    return None


def read_sheet(ws):
    course_name = ws["B3"].value
    trainees = ws["B4"].value
    space = ws["C8"].value
    boilerplate = ws["A13"].value
    equip = []
    r = 16
    while True:
        a = ws.cell(r, 1).value
        if a is None and ws.cell(r, 2).value is None:
            break
        if isinstance(a, str) and a.strip().lower() == "sum":
            break
        name = ws.cell(r, 2).value
        if name:
            equip.append(
                {
                    "name": str(name).strip(),
                    "required": ws.cell(r, 3).value,
                    "weight": ws.cell(r, 5).value,
                    "remark": ws.cell(r, 7).value or None,
                }
            )
        r += 1
    # footnote under the table (e.g. the air-conditioning halving rule), if any
    note = None
    for rr in range(r, r + 12):
        v = ws.cell(rr, 1).value
        if isinstance(v, str) and v.strip().startswith("*"):
            note = v.strip()
            break
    return course_name, trainees, space, boilerplate, equip, note


def min_rules(note, equip):
    """Footnote 'at least N <items> [and M <items>]. Otherwise ... halved' -> [{row, min, item}].
    Each item is tied to the one equipment row whose name contains every word of it
    (plural 's' dropped)."""
    m = re.search(r"at least (.+?)\. Otherwise", note or "")
    if not m:
        return []
    rules = []
    for part in m.group(1).split(" and "):
        count, item = re.match(r"(\d+) (.+)", part.strip()).groups()
        stems = [w.rstrip("s") for w in re.findall(r"[a-z]+", item.lower())]
        rows = [i for i, e in enumerate(equip) if all(s in e["name"].lower() for s in stems)]
        assert len(rows) == 1, (item, rows)
        rules.append({"row": rows[0], "min": int(count), "item": item})
    return rules


# ---------- 2b. cs_pdf fallback fuzzy match (when peer-data has none) ----------


def fuzzy_match_pdf(org_slug, course_name):
    d = CS_DIR / org_slug
    if not d.is_dir():
        return None
    target = norm(course_name)
    target_sq = target.replace(" ", "")
    target_tokens = set(target.split())
    sig_tokens = [t for t in target_tokens if len(t) >= MIN_TOKEN_LENGTH]
    best, best_ratio = None, 0.0
    for pdf in d.glob("*.pdf"):
        cand = norm(pdf.stem)
        cand_sq = cand.replace(" ", "")
        if target in cand or cand in target or target_sq in cand_sq or cand_sq in target_sq:
            return f"competency-standards/{org_slug}/{pdf.name}"
        hits = sum(1 for t in sig_tokens if t in cand_sq)
        ratio = hits / len(sig_tokens) if sig_tokens else 0
        if ratio > best_ratio:
            best, best_ratio = pdf, ratio
    if best and best_ratio >= PDF_MATCH_THRESHOLD:
        return f"competency-standards/{org_slug}/{best.name}"
    return None


# ---------- 3. approved-date fallback: pdftotext cover page ----------

DATE_RES = [
    re.compile(r"(\d{1,2})\s+(" + "|".join(MONTHS) + r")[a-z]*\s+'?(\d{2,4})", re.I),
    re.compile(r"(\d{1,2})\s+(" + "|".join(MONTHS_FULL) + r")\s+'?(\d{2,4})", re.I),
]


def date_from_text(text):
    for rx in DATE_RES:
        m = rx.search(text)
        if m:
            d, mo, y = m.groups()
            mo_l = mo.lower()
            month = MONTHS.get(mo_l[:3], MONTHS_FULL.get(mo_l))
            if not month:
                continue
            y = int(y)
            if y < TWO_DIGIT_YEAR_LIMIT:
                y += 2000
            try:
                return f"{int(d):02d} {list(MONTHS)[month - 1].capitalize()} {y}"
            except Exception:
                continue
    return None


def extract_pdf_date(pdf_path):
    try:
        out = subprocess.run(
            ["pdftotext", "-l", "1", str(pdf_path), "-"], capture_output=True, text=True, timeout=30
        ).stdout
    except Exception:
        return None
    return date_from_text(out)


def resolve_approved_and_pdf(course, peer_course):
    """Approved date and CS PDF: peer-data first, then PDF file name, then the PDF cover page."""
    approved, cs_pdf = (
        (peer_course.get("approved"), peer_course.get("cs_pdf")) if peer_course else (None, None)
    )
    cs_pdf = cs_pdf or fuzzy_match_pdf(course.org_slug, course.name)
    if approved is None and cs_pdf:
        approved = date_from_text(Path(cs_pdf).stem)
    if approved is None and cs_pdf and (ROOT / cs_pdf).exists():
        approved = extract_pdf_date(ROOT / cs_pdf)
    return approved, cs_pdf


def build_entry(course, sheet_name, ws, peer_course):
    _, trainees, space, boilerplate, equip, note = read_sheet(ws)
    approved, cs_pdf = resolve_approved_and_pdf(course, peer_course)
    return {
        "org": course.org,
        "org_slug": course.org_slug,
        "course_name": course.name,
        "sheet": sheet_name,
        "sector": course.sector,
        "trainees": int(trainees) if trainees is not None else None,
        "space": str(space).strip() if space else "",
        "boilerplate": str(boilerplate).strip() if boilerplate else "",
        "note": note,
        "min_rules": min_rules(note, equip),
        "approved": approved,
        "equipment": equip,
        "xlsx": f"lab-standards/{course.org_slug}-lab-standard.xlsx",
        "cs_pdf": cs_pdf,
    }


def build_entries(orgs, peer_by_key):
    """One entry per indexed course, plus the courses that could not be matched."""
    entries, unmatched_sheets, no_peer = [], [], []
    for org_name, org_slug, courses in orgs:
        xlsx_path = LAB_DIR / f"{org_slug}-lab-standard.xlsx"
        if not xlsx_path.exists():
            print(f"MISSING WORKBOOK: {xlsx_path}")
            continue
        wb = openpyxl.load_workbook(xlsx_path, data_only=True)
        for course_name, sector in courses:
            sheet_name = find_sheet(wb, course_name)
            if sheet_name is None:
                unmatched_sheets.append((org_slug, course_name))
                continue
            peer_course = peer_by_key.get((org_slug, norm(course_name)))
            if peer_course is None:
                no_peer.append((org_slug, course_name))
            course = Course(org_name, org_slug, course_name, sector)
            entries.append(build_entry(course, sheet_name, wb[sheet_name], peer_course))
    return entries, unmatched_sheets, no_peer


def label(entry):
    return (entry["org_slug"], entry["course_name"])


def check_entries(entries):
    """Fail loudly if the generated data cannot drive the site."""
    print(f"total entries: {len(entries)} (expect {EXPECTED_ENTRIES})")
    assert len(entries) == EXPECTED_ENTRIES, (
        f"expected {EXPECTED_ENTRIES} entries, got {len(entries)}"
    )
    labels = [label(e) for e in entries]
    dupes = sorted({x for x in labels if labels.count(x) > 1})
    print(f"duplicate (org_slug, course_name): {dupes}")
    assert not dupes
    for e in entries:
        assert e["equipment"], f"empty equipment: {label(e)}"
        assert sum(r["weight"] or 0 for r in e["equipment"]) > 0
        assert isinstance(e["trainees"], int), (*label(e), e["trainees"])
        assert (ROOT / e["xlsx"]).exists(), f"missing xlsx: {e['xlsx']}"
        assert not e["cs_pdf"] or (ROOT / e["cs_pdf"]).exists(), f"missing pdf: {e['cs_pdf']}"


def equipment_rows_where(entries, column):
    """Rows whose `column` (required or weight) is missing or not positive."""
    return [
        (*label(e), row["name"])
        for e in entries
        for row in e["equipment"]
        if not row[column] or row[column] <= 0
    ]


def print_list(title, items):
    print(f"\n{title} ({len(items)}):")
    for item in items:
        print(" ", item)


def print_report(entries, unmatched_sheets, no_peer):
    print("\n=== VALIDATION REPORT ===")
    check_entries(entries)
    print_list(
        "equipment rows with required<=0/null [source-data anomaly, not a script bug]",
        equipment_rows_where(entries, "required"),
    )
    print_list("equipment rows with weight<=0/null", equipment_rows_where(entries, "weight"))
    print_list("entries with cs_pdf=null", [label(e) for e in entries if not e["cs_pdf"]])
    print_list("entries with approved=null", [label(e) for e in entries if not e["approved"]])
    print_list(
        "entries with sector=null [expect 5, all Beautification]",
        [label(e) for e in entries if not e["sector"]],
    )
    print_list(
        "entries missing '80%' in boilerplate",
        [label(e) for e in entries if "80%" not in e["boilerplate"]],
    )
    print(f"\nunmatched sheets (course in index, no xlsx sheet found): {unmatched_sheets}")
    print(f"no peer-data match (approved/cs_pdf left null/needs pdftotext): {no_peer}")


def main():
    peer = json.loads(PEER.read_text(encoding="utf-8"))
    peer_by_key = {(c["org_slug"], norm(c["course_name"])): c for c in peer["courses"]}
    entries, unmatched_sheets, no_peer = build_entries(parse_index(), peer_by_key)
    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print_report(entries, unmatched_sheets, no_peer)


if __name__ == "__main__":
    main()
