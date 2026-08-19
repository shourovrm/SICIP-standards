#!/usr/bin/env python3
"""Dump the tail of a CS doc (Workshop/Lab Facility Standard lives at the end).
Usage: dump_tail.py <file.pdf|file.docx> [n]"""
import sys, os

def dump_pdf(path, n):
    from pypdf import PdfReader
    r = PdfReader(path); tot = len(r.pages)
    for i in range(max(0, tot - n), tot):
        print(f"===== PAGE {i+1}/{tot} =====")
        print(r.pages[i].extract_text() or "")

def dump_docx(path, n):
    import docx
    from docx.oxml.table import CT_Tbl
    from docx.oxml.text.paragraph import CT_P
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    doc = docx.Document(path); blocks = []
    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            p = Paragraph(child, doc)
            if p.text.strip(): blocks.append(("P", p.text))
        elif isinstance(child, CT_Tbl):
            t = Table(child, doc)
            blocks.append(("T", "\n".join(" | ".join(c.text.strip() for c in row.cells) for row in t.rows)))
    for kind, txt in blocks[-n:]:
        if kind == "T": print("----- TABLE -----\n" + txt + "\n----- /TABLE -----")
        else: print(txt)

def main():
    path = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else None
    ext = os.path.splitext(path)[1].lower()
    (dump_pdf if ext == ".pdf" else dump_docx)(path, n or (6 if ext == ".pdf" else 80))

if __name__ == "__main__": main()
