#!/usr/bin/env python3
"""Dump the FIRST page / opening blocks of a CS doc (sector name lives here).
Usage: dump_head.py <file.pdf|file.docx> [n]"""
import sys, os

def head_pdf(path, n):
    from pypdf import PdfReader
    r = PdfReader(path)
    for i in range(min(n, len(r.pages))):
        print(f"===== PAGE {i+1} =====")
        print(r.pages[i].extract_text() or "")

def head_docx(path, n):
    import docx
    from docx.oxml.table import CT_Tbl
    from docx.oxml.text.paragraph import CT_P
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    doc = docx.Document(path); shown = 0
    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            p = Paragraph(child, doc)
            if p.text.strip(): print(p.text); shown += 1
        elif isinstance(child, CT_Tbl):
            for row in Table(child, doc).rows:
                print(" | ".join(c.text.strip() for c in row.cells)); shown += 1
        if shown >= n: break

def main():
    path = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else None
    ext = os.path.splitext(path)[1].lower()
    (head_pdf if ext == ".pdf" else head_docx)(path, n or (2 if ext == ".pdf" else 30))

if __name__ == "__main__": main()
