#!/usr/bin/env bash
# Moved: the site is now an Astro app in apps/web. This wrapper keeps old commands working.
echo "note: site/deploy.sh is deprecated, use scripts/deploy.sh" >&2
exec "$(cd "$(dirname "$0")/.." && pwd)/scripts/deploy.sh" "$@"
