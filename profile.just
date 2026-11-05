# Profile for this repo: static site (vanilla JS in web/) + Python scripts + stdlib unittest.
# There is no stack profile for this, so it is composed by hand from the python and ts ones.
# Tools run through uvx/npx at pinned versions; nothing is installed in the repo.
ruff := "uvx ruff@0.17.4"

# Python lint and format check (JS lint is `just lint-js`, not in `check` yet)
lint:
    {{ruff}} check scripts tests
    {{ruff}} format --check scripts tests

# No type checker for this stack: parse every JS and Python file instead
types:
    for f in web/js/*.js; do node --check "$f" || exit 1; done
    python3 -I -c "import ast, pathlib; [ast.parse(p.read_text(), str(p)) for d in ('scripts', 'tests') for p in sorted(pathlib.Path(d).glob('*.py'))]"

dead:
    uvx vulture@2.16 scripts --min-confidence 80

test:
    PYTHONPATH=scripts python3 -m unittest discover -s tests

# JavaScript lint with the profile's limits. app.js still exceeds them, so it is not part of `check`.
lint-js:
    npx --yes oxlint@^1.37 --deny-warnings web/js

# Static site: nothing to build. Deploy = push to main (Cloudflare Pages builds from git).
build:
    @echo "no build step; deploy is git push"

# Serve the site at http://localhost:8765 (the hash router needs the repository root)
dev port="8765":
    python3 -m http.server {{port}}

# Fastest check for one path: lint it, then run the tests
slice-check path="scripts":
    {{ruff}} check {{path}}
    PYTHONPATH=scripts python3 -m unittest discover -s tests
