#!/usr/bin/env python3
"""Assemble per-course structured data for the site build -> data/peer-data.json.
Sources: lab-standards/*.xlsx (equipment/trainees/space), docs/reference-lab-index.html
(sector map), competency-standards/<ORG>/*.pdf (approved date from filename).

Warning: the committed data/peer-data.json has hand-corrected dates; running this
script overwrites it with the filename-derived values only.
"""

import glob
import html
import json
import os
import re

import openpyxl

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAB = os.path.join(REPO, "lab-standards")
CS = os.path.join(REPO, "competency-standards")
IDX = os.path.join(REPO, "docs", "reference-lab-index.html")
OUT = os.path.join(REPO, "data", "peer-data.json")

MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}
MONTH_ABBR = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]
MAX_DAY = 31
MAX_MONTH = 12
TWO_DIGIT_YEAR_LIMIT = 100  # a year below this is written 'yy' and means 20yy
FIRST_EQUIPMENT_ROW = 16
IGNORED_WORDS = {
    "cs",
    "final",
    "m",
    "the",
    "of",
    "and",
    "for",
    "on",
    "in",
    "bmet",
    "dte",
    "sicip",
    "develop",
    "review",
    "revised",
    "version",
    "v2",
    "done",
}


def full_year(year):
    return 2000 + year if year < TWO_DIGIT_YEAR_LIMIT else year


def valid_day_month(day, month):
    return 1 <= day <= MAX_DAY and 1 <= month <= MAX_MONTH


def date_with_month_name(s):
    """'12 Mar 2025', '3 September 25' ..."""
    m = re.search(r"(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*(\d{2,4})", s)
    if not m:
        return None
    month = MONTHS.get(m.group(2).lower().rstrip("."))
    if not month or not 1 <= int(m.group(1)) <= MAX_DAY:
        return None
    return f"{int(m.group(1)):02d} {MONTH_ABBR[month]} {full_year(int(m.group(3)))}"


def date_with_separators(s):
    """'12.03.2025', '12-3-25' ..."""
    m = re.search(r"(?<!\d)(\d{1,2})[ ./-](\d{1,2})[ ./-](\d{2,4})(?!\d)", s)
    if not m or not valid_day_month(int(m.group(1)), int(m.group(2))):
        return None
    return f"{int(m.group(1)):02d} {MONTH_ABBR[int(m.group(2))]} {full_year(int(m.group(3)))}"


def date_ddmmyyyy(s):
    m = re.search(r"(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)", s)
    if not m or not valid_day_month(int(m.group(1)), int(m.group(2))):
        return None
    return f"{int(m.group(1)):02d} {MONTH_ABBR[int(m.group(2))]} {m.group(3)}"


def date_ddmmyy(s):
    m = re.search(r"(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)", s)
    if not m or not valid_day_month(int(m.group(1)), int(m.group(2))):
        return None
    return f"{int(m.group(1)):02d} {MONTH_ABBR[int(m.group(2))]} 20{m.group(3)}"


def parse_date(filename):
    """'DD Mon YYYY' from the first date format found in a CS file name, else None."""
    s = re.sub(r"[_']", " ", filename)
    for finder in (date_with_month_name, date_with_separators, date_ddmmyyyy, date_ddmmyy):
        found = finder(s)
        if found:
            return found
    return None


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def toks(s):
    return set(re.findall(r"[a-z0-9]+", s.lower())) - IGNORED_WORDS


def read_sector_map():
    """(org_slug_norm, course_norm) -> sector, from the reference index."""
    with open(IDX) as f:
        index_html = f.read()
    sectors = {}
    for org_attr, block in re.findall(
        r'<section class="org" data-org="([^"]+)">(.*?)</section>', index_html, re.S
    ):
        org = norm(html.unescape(org_attr))  # unescape so 'isc-t&amp;h' -> 'iscth'
        for name, full in re.findall(
            r'<span class="c-name">(.*?)</span><span class="c-full">(.*?)</span>', block, re.S
        ):
            course = html.unescape(re.sub(r"<[^>]+>", "", name))
            m = re.search(r"Sector:\s*(.+)", html.unescape(full))
            sectors[(org, norm(course))] = m.group(1).strip() if m else None
    return sectors


def read_equipment(ws):
    equip, r = [], FIRST_EQUIPMENT_ROW
    while ws.cell(r, 1).value not in ("Sum", None):
        name = ws.cell(r, 2).value
        if name is None:
            break
        equip.append({"name": name, "required": ws.cell(r, 3).value, "weight": ws.cell(r, 5).value})
        r += 1
    return equip


def read_records(wb):
    return [
        {
            "course_name": ws["B3"].value,
            "sheet": ws.title,
            "trainees": ws["B4"].value,
            "space": ws["C8"].value,
            "equipment": read_equipment(ws),
            "pdf": None,
        }
        for ws in wb.worksheets
    ]


def assign_pdfs(recs, pdfs):
    """Best-first assignment of PDFs to sheets (avoids greedy Construction/Industry clashes)."""
    pairs = sorted(
        (
            (len(toks(rec["course_name"] or rec["sheet"]) & toks(os.path.splitext(p)[0])), i, p)
            for i, rec in enumerate(recs)
            for p in pdfs
        ),
        reverse=True,
    )
    taken_sheet, taken_pdf = set(), set()
    for score, i, p in pairs:
        if score < 1 or i in taken_sheet or p in taken_pdf:
            continue
        recs[i]["pdf"] = p
        taken_sheet.add(i)
        taken_pdf.add(p)


def build_course(slug, rec, sectors):
    pdf = rec["pdf"]
    approved = parse_date(pdf) if pdf else None
    return {
        "org": slug,
        "org_slug": slug,
        "course_name": rec["course_name"],
        "sheet": rec["sheet"],
        "sector": sectors.get((norm(slug), norm(rec["course_name"] or ""))),
        "trainees": rec["trainees"],
        "space": rec["space"],
        "approved": approved,
        "approved_source": ("filename" if approved else None),
        "equipment": rec["equipment"],
        "cs_pdf": (f"competency-standards/{slug}/{pdf}" if pdf else None),
    }


def read_org(wb_path, sectors):
    slug = os.path.basename(wb_path).replace("-lab-standard.xlsx", "")
    org_dir = os.path.join(CS, slug)
    pdfs = (
        [os.path.basename(p) for p in glob.glob(os.path.join(org_dir, "*.pdf"))]
        if os.path.isdir(org_dir)
        else []
    )
    recs = read_records(openpyxl.load_workbook(wb_path, data_only=False))
    assign_pdfs(recs, pdfs)
    return [build_course(slug, rec, sectors) for rec in recs]


def labels(courses):
    return [f"{c['org']} / {c['course_name']}" for c in courses]


def known_mismatches(courses, mismatches):
    nodate = labels(c for c in courses if not c["approved"])
    nopdf = labels(c for c in courses if not c["cs_pdf"])
    nosector = labels(c for c in courses if not c["sector"])
    return [
        *mismatches,
        "BPI 'Electrical Works V2' duplicate: already REMOVED from BPI workbook + indexes "
        "(BPI now 3 sheets, total 162). No action needed.",
        f"{len(nodate)} courses have no date parsed from the CS filename (need cover-page date): "
        + "; ".join(nodate),
        f"{len(nosector)} courses have null sector (all Beautification): " + "; ".join(nosector),
        (
            f"{len(nopdf)} courses did not auto-match a CS PDF by filename tokens "
            "(verify manually): " + "; ".join(nopdf)
        )
        if nopdf
        else "All courses matched a CS PDF.",
    ]


def main():
    sectors = read_sector_map()
    courses, mismatches = [], []
    for wb_path in sorted(glob.glob(os.path.join(LAB, "*-lab-standard.xlsx"))):
        if os.path.basename(wb_path).startswith(
            "Weaving-and-Finishing"
        ):  # standalone dup of BJMA Weaving
            mismatches.append(
                "Weaving-and-Finishing-Jute-lab-standard.xlsx is a standalone duplicate of BJMA's "
                "'Weaving and Finishing' sheet — excluded from courses."
            )
            continue
        courses += read_org(wb_path, sectors)

    nodate = [c for c in courses if not c["approved"]]
    nopdf = [c for c in courses if not c["cs_pdf"]]
    nosector = [c for c in courses if not c["sector"]]
    out = {
        "schema": {
            "courses": "list of course objects",
            "course": "org, org_slug, course_name, sheet, sector|null, trainees, space, "
            "approved ('DD Mon YYYY'|null), approved_source, "
            "equipment[{name, required(int|str), weight(int)}], cs_pdf(repo-relative|null)",
        },
        "counts": {
            "courses": len(courses),
            "with_date": len(courses) - len(nodate),
            "with_pdf": len(courses) - len(nopdf),
            "with_sector": len(courses) - len(nosector),
        },
        "known_mismatches": known_mismatches(courses, mismatches),
        "courses": courses,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    counts = out["counts"]
    print(
        f"wrote data/peer-data.json: {len(courses)} courses | dates {counts['with_date']} "
        f"| pdf {counts['with_pdf']} | sector {counts['with_sector']}"
    )
    print("no-date:", len(nodate), "| no-pdf:", len(nopdf), "| no-sector:", len(nosector))


if __name__ == "__main__":
    main()
