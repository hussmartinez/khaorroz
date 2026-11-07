#!/usr/bin/env bash
# Validate content, build the Astro site (+ Pagefind index) and publish it to nginx
# (https://arroz.hussmartinez.xyz — tailnet admin devices only, see SilverBullet journal 024).
# Serialised with flock so concurrent deploys (research agent, translator, humans) can't collide.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
exec 9>/tmp/arros-deploy.lock
flock 9
cd "$REPO"
stray=$(ls recipe_*.md provincial_*.md history.md i18n/*/*.md 2>/dev/null || true)
if [ -n "$stray" ]; then
  echo "✗ Content files found in the repo root — they belong in content/ now:" >&2
  echo "$stray" | sed 's/^/    /' >&2
  echo "  Move them:  mv <file> content/   (translations go in content/i18n/<lang>/)" >&2
  exit 1
fi
bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null
rm -rf apps/web/dist   # never publish a stale build
log=$(mktemp)
if ! (cd apps/web && ASTRO_TELEMETRY_DISABLED=1 bun run build) >"$log" 2>&1; then
  if grep -q "Content check failed" "$log"; then
    sed -n '/Content check failed/,/^\s*at /p' "$log" | grep -v '^\s*at ' >&2
    echo "  Fix the file(s) above; run 'bun scripts/check.ts' to re-check without building." >&2
  else
    grep -vE '^\s+(├|└)' "$log" | tail -30 >&2
  fi
  echo "✗ build failed — nothing was published (the live site is unchanged)" >&2
  rm -f "$log"; exit 1
fi
grep -E "Indexed [0-9]+ pages" "$log" || true
rm -f "$log"
test -f apps/web/dist/index.html || { echo "✗ build produced no index.html — nothing published" >&2; exit 1; }
rsync -a --delete apps/web/dist/ /var/www/arroz/
echo "==> Deployed to /var/www/arroz → https://arroz.hussmartinez.xyz"
