#!/usr/bin/env python3
"""Build SICIP lab-standard xlsx sheets from structured course data.
build_sheet(ws, course) writes one styled sheet matching the Beautification template.
main(json_path, out_dir) builds a full workbook from {outfile, courses:[...]}.
Course: {sheet, course_name, trainees, space, equipment:[[name, qty, weight], ...], note?}.
qty may be a string; leading integer is used and the original kept in Remarks.
"""

import json
import os
import re
import sys
from dataclasses import dataclass

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

THIN = Side(style="thin")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HDR_FILL = PatternFill("solid", fgColor="FFD9D9D9")
LEFT = Alignment(horizontal="left", vertical="top", wrap_text=True)
INVALID = re.compile(r"[:\\/?*\[\]]")
FIRST_ROW = 16  # first equipment row in the template

BOILER = (
    "•The institute shall not use the same facilities for any other "
    "projects/organizations offering a similar course.\n"
    "•The institute must provide sufficient evidence to prove ownership of "
    "the proposed training equipment.\n"
    "The list denotes the minimum training equipment and facility required to "
    "effectively conduct training for a specific course. Additionally, the "
    "institute must ensure that all other necessary training tools, equipment, "
    "and furniture are available to meet the requirement of competency standards "
    "(CS) provided by SICIP.\n"
    "For the operation of training course on {course}, the institute must ensure "
    "the availability of at least 80% of the major training equipment and "
    "training facilities (according to the CS) to be eligible for SICIP training "
    "delivery. If the score is below 80%, the remaining equipment and facilities "
    "need to be installed before the commencement of the training.\n"
    "The institute will also provide all other hand tools and power tools as per "
    "CS for {n} trainees. Also, they will arrange adequate seating arrangement "
    "and classroom setup for the {n} trainees."
)


def font11(bold=False):
    return Font(name="Arial", size=11, bold=bold)


def centered(wrap=False):
    return Alignment(horizontal="center", vertical="center", wrap_text=wrap)


@dataclass(frozen=True)
class Style:
    font: Font | None = None
    fill: PatternFill | None = None
    align: Alignment | None = None
    border: bool = True


TITLE = Style(
    Font(name="Arial", size=14, bold=True),
    align=Alignment(horizontal="center", vertical="bottom"),
    border=False,
)
LABEL = Style(font11(True), align=centered(True))
HEADING = Style(font11(True), border=False)
SPACE = Style(font11(True), align=Alignment(horizontal="left", vertical="center", wrap_text=True))
PARAGRAPH = Style(font11(False), align=LEFT, border=False)
COLUMN_HEADER = Style(font11(True), fill=HDR_FILL, align=centered(True))
ROW_NUMBER = Style(font11(), align=centered())
ROW_NAME = Style(font11(), align=LEFT)
ROW_VALUE = Style(font11(), align=centered(True))
TOTAL = Style(font11(True), align=centered())
TOTAL_BLANK = Style(font11(True))
NO_BORDER = Style(border=False)
PLAIN = Style()


def safe_sheet(name, used):
    name = INVALID.sub(" ", str(name)).strip()[:31] or "Sheet"
    base, i = name, 1
    while name.lower() in used:
        suf = f" {i}"
        name = base[: 31 - len(suf)] + suf
        i += 1
    used.add(name.lower())
    return name


def set_cell(ws, coord, val, style=PLAIN):
    c = ws[coord]
    c.value = val
    if style.font:
        c.font = style.font
    if style.fill:
        c.fill = style.fill
    if style.align:
        c.alignment = style.align
    if style.border:
        c.border = BORDER
    return c


def parse_quantity(raw):
    """Required quantity and remark from a quantity that may be a number or text like '3 sets'."""
    if isinstance(raw, bool):
        return None, None
    if isinstance(raw, int):
        return raw, None
    m = re.match(r"\s*(\d+)", str(raw))
    return (int(m.group(1)) if m else None), (str(raw).strip() or None)


def write_title(ws, course, n):
    ws.column_dimensions["A"].width = 15.17
    ws.column_dimensions["B"].width = 33.13
    for col in "CDEFG":
        ws.column_dimensions[col].width = 13.72
    ws.merge_cells("A1:G1")
    set_cell(ws, "A1", "Course-wise Training Infrastructure and Facilities", TITLE)
    ws.row_dimensions[1].height = 17.35
    set_cell(ws, "A3", "Course Name:", LABEL)
    set_cell(ws, "B3", course, LABEL)
    set_cell(ws, "A4", "Number of Trainees:", LABEL)
    set_cell(ws, "B4", n, LABEL)
    ws.row_dimensions[4].height = 26.85


def write_space(ws, course, n, space):
    title = (
        "Course-wise Training Space (Theoretical Classroom, Workshop/ Lab/ Classroom cum Workshop)"
    )
    set_cell(ws, "A6", title, HEADING)
    set_cell(ws, "B7", "Course Name", LABEL)
    ws.merge_cells("C7:G7")
    set_cell(ws, "C7", f"SICIP required space for {n} trainees", LABEL)
    set_cell(ws, "B8", course, LABEL)
    ws.merge_cells("C8:G8")
    set_cell(ws, "C8", space, SPACE)
    ws.row_dimensions[8].height = 52.2


def write_conditions(ws, course, n):
    set_cell(ws, "A11", "Major Training Equipment and Training Facilities", HEADING)
    ws.merge_cells("A13:G13")
    set_cell(ws, "A13", BOILER.format(course=course, n=n), PARAGRAPH)
    ws.row_dimensions[13].height = 115.65


def write_equipment(ws, equip):
    headers = [
        "S.N.",
        "Major Equipment and Training facilities",
        "Required facilities",
        "Available facilities",
        "Weights\n(out of 10)",
        "Weighted scores",
        "Remarks",
    ]
    for col, text in zip("ABCDEFG", headers, strict=True):
        set_cell(ws, f"{col}15", text, COLUMN_HEADER)
    ws.row_dimensions[15].height = 26.85
    for i, (name, raw_qty, *rest) in enumerate(equip):
        r = FIRST_ROW + i
        qty, remark = parse_quantity(raw_qty)
        set_cell(ws, f"A{r}", i + 1, ROW_NUMBER)
        set_cell(ws, f"B{r}", name, ROW_NAME)
        set_cell(ws, f"C{r}", qty, ROW_VALUE)
        set_cell(ws, f"D{r}", 0, ROW_VALUE)
        set_cell(ws, f"E{r}", rest[0] if rest else None, ROW_VALUE)
        set_cell(ws, f"F{r}", f"=IFERROR(MIN(C{r},D{r})*E{r}/C{r},0)", ROW_VALUE)
        set_cell(ws, f"G{r}", remark, ROW_VALUE)
        ws.row_dimensions[r].height = 14.15


def merged_label(ws, row, label, blank_cols):
    """A label in column A merged across A..last blank column, with bordered blanks."""
    set_cell(ws, f"A{row}", label, TOTAL)
    for col in blank_cols:
        set_cell(ws, f"{col}{row}", None, TOTAL_BLANK)
    ws.merge_cells(f"A{row}:{blank_cols[-1]}{row}")


def write_totals(ws, last):
    sum_r, score_r, spacer_r, pts_r = last + 1, last + 2, last + 3, last + 4
    merged_label(ws, sum_r, "Sum", "BCD")
    set_cell(ws, f"E{sum_r}", f"=SUM(E{FIRST_ROW}:E{last})", TOTAL)
    set_cell(ws, f"F{sum_r}", f"=SUM(F{FIRST_ROW}:F{last})", TOTAL)
    set_cell(ws, f"G{sum_r}", None, TOTAL_BLANK)
    merged_label(ws, score_r, "Score out of 100", "BCDE")
    set_cell(ws, f"F{score_r}", f"=F{sum_r}/E{sum_r}*100", TOTAL)
    set_cell(ws, f"G{score_r}", None, TOTAL_BLANK)
    set_cell(ws, f"A{spacer_r}", None, NO_BORDER)
    ws.merge_cells(f"A{spacer_r}:G{spacer_r}")
    ws.row_dimensions[spacer_r].height = 9.75
    merged_label(ws, pts_r, "Total achieved points out of 30  ", "BCDE")
    set_cell(ws, f"F{pts_r}", f"=F{score_r}*30/100", TOTAL)
    set_cell(ws, f"G{pts_r}", "Points", TOTAL)


def write_note(ws, row, note):
    """Footnote under the table (e.g. the air-conditioning halving rule)."""
    ws.merge_cells(f"A{row}:G{row}")
    set_cell(ws, f"A{row}", note, PARAGRAPH)
    ws.row_dimensions[row].height = 14.15


def build_sheet(ws, co):
    course = co["course_name"]
    n = co.get("trainees", 25)
    equip = co["equipment"]
    write_title(ws, course, n)
    write_space(ws, course, n, co.get("space", ""))
    write_conditions(ws, course, n)
    write_equipment(ws, equip)
    last = FIRST_ROW + len(equip) - 1
    write_totals(ws, last)
    if co.get("note"):
        write_note(ws, last + 5, co["note"])


def main(json_path, out_dir):
    with open(json_path) as f:
        d = json.load(f)
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    used = set()
    for co in d["courses"]:
        build_sheet(wb.create_sheet(safe_sheet(co["sheet"], used)), co)
    out = os.path.join(out_dir, d["outfile"])
    wb.save(out)
    print(f"wrote {out}  ({len(d['courses'])} sheets)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
