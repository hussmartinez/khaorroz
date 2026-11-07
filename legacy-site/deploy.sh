#!/usr/bin/env bash
# Build the static site from the repo-root Markdown and publish it to nginx
# (https://arroz.hussmartinez.xyz, tailnet admin devices only).
set -euo pipefail
cd "$(dirname "$0")"
bun install --frozen-lockfile >/dev/null
bun build.ts
rsync -a --delete dist/ /var/www/arroz/
echo "==> Deployed to /var/www/arroz → https://arroz.hussmartinez.xyz"
