# Base justfile. The stack profile (profile.just, copied from
# ~/.claude/stacks/<stack>/) defines: lint, types, dead, test, build, dev,
# slice-check. `just check` is the one command run before a commit.
import 'profile.just'

check: lint types dead test

# Reports files longer than the soft limit. Reported, never blocking.
long-files limit="400":
    @git ls-files | grep -vE '\.(lock|json|svg|png|jpg)$' | xargs wc -l 2>/dev/null | awk -v lim={{limit}} '$1 > lim && $2 != "total" {print}' || true
