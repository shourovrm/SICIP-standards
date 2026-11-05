#!/usr/bin/env bash
# PreToolUse: block edits to the files that define the rules.
# Edit/Write are blocked by target path. Bash is blocked only when the
# command both names a protected file and looks like a write to it, so
# `cat justfile` and `git diff hooks/` still work.
# Exit 2 = block; stderr goes back to the agent. A guard against casual
# gaming, not a security boundary.
set -u
in=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$in")
target=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // .tool_input.command // ""' <<<"$in")

protected='(^|/| )(justfile|profile\.just|hooks/[^ ]*|\.claude/settings[^ ]*|\.oxlintrc\.json|ruff\.toml|detekt\.yml|detekt-baseline\.xml|knip\.json|\.golangci\.yml|gradle\.properties)( |$|")'
writes='(>|(^|[ ;&|(])(tee|sed -i|perl -i|rm|mv|cp|truncate|chmod|ln) )'

block() {
  echo "Blocked: rule/config file is protected. Tell the user which limit seems wrong instead of editing it." >&2
  exit 2
}

if [[ $tool == "Bash" ]]; then
  [[ $target =~ $protected ]] && [[ $target =~ $writes ]] && block
else
  [[ $target =~ $protected ]] && block
fi
exit 0
