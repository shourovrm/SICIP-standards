# SICIP Standards: static site, no build step. `just check` is the gate before every commit.

default:
    @just --list

# Serve the site at http://localhost:8765 (hash router needs the repository root)
serve port="8765":
    python3 -m http.server {{port}}

# Everything that must pass before a commit
check: js py data

# Syntax-check the browser JavaScript
js:
    for f in web/js/*.js; do node --check "$f" || exit 1; done

# Syntax-check the Python scripts (parses only, leaves no .pyc behind)
py:
    python3 -I -c "import ast, pathlib; [ast.parse(p.read_text(), str(p)) for p in sorted(pathlib.Path('scripts').glob('*.py'))]"

# data/data.json parses, and every workbook and PDF it points to exists
data:
    #!/usr/bin/env python3
    import json, pathlib
    entries = json.load(open("data/data.json"))
    paths = [p for e in entries for p in (e["xlsx"], e["cs_pdf"]) if p]
    missing = [p for p in paths if not pathlib.Path(p).exists()]
    for p in missing:
        print("missing:", p)
    print(f"{len(entries)} courses, {len(paths)} files referenced, {len(missing)} missing")
    raise SystemExit(1 if missing else 0)
