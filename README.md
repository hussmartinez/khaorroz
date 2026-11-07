# Arròs — the rice of Spain, town by town

History and traditional recipes of Spanish rice dishes, in English, Español, Català / Valencià and ไทย.
Live (private, tailnet admin devices): https://arroz.hussmartinez.xyz

## Layout (bun workspaces)

| Path | What |
|---|---|
| `content/` | English source Markdown: `recipe_*.md`, `provincial_*.md`, `history.md`, `README.md` (the site's About page) |
| `content/i18n/<lang>/` | Translations (`es`, `ca`, `th`), same file names, front matter `source_hash:` |
| `apps/web/` | Astro 7 site (static output, Pagefind search, sitemap) |
| `packages/content/` | Loading, parsing and **schema validation** of the Markdown (zod) |
| `packages/pans/` | Generative SVG "pan portraits" for every dish |
| `scripts/` | `deploy.sh`, `check.ts`, `i18n-status.ts` |
| `tools/atlas.py` | Research agent's cross-link / index maintainer (works on `content/`) |
| `legacy-site/` | Previous hand-written generator, kept for reference |

## Commands

```sh
bun install
bun run check                 # validate content (same rules as the build)
bun run dev                   # Astro dev server
bun scripts/i18n-status.ts th # missing/stale translations for a language
scripts/deploy.sh             # check + build + Pagefind + publish to nginx (flock-serialised)
```

Content rules enforced by the build (a violation fails the deploy and names the file):
- H1 `# Spanish name / Local name`
- nav line `> ⬅ [README](README.md) · [Region](provincial_x.md)` linking existing region files
- `**Primary Geographic Zone:**` and `**Liquid & Texture Profile:**` (exactly one of Seco / Meloso / Caldoso) bullets
- a `## 4.` master-recipe section

Ads: `apps/web/ads.json` (`placeholder` | `off` | `live`).
