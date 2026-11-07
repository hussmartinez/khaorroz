# Arròs site

Static site generated from the research Markdown in the repo root.

- `bun install` (once)
- `bun run dev`: builds, watches the root `*.md` files and serves at http://127.0.0.1:4321 (`HOST=0.0.0.0` to expose it on the tailnet)
- `bun run build`: writes the static output to `site/dist/` (deploy anywhere, e.g. nginx)

Content mapping: `recipe_*.md` → `recipes/`, `provincial_*.md` → `provinces/`, `history.md` → History page (until it exists, History is built from each recipe's history section), `README.md` → About page.
Each recipe card reads its texture (seco / meloso / caldoso) from the "Liquid & Texture Profile" bullet and its provinces from the `> ⬅` nav line.

## Languages (en, es, ca, th)
- English is the source and lives at `/`. The others live at `/es/`, `/ca/` and `/th/`, with the same paths. Interface strings are in `i18n.ts`.
- A translation is `../i18n/<lang>/<same file name>.md`. It starts with front matter `source_hash: <hash>`, where the hash comes from `bun i18n-status.ts`. Keep the H1 `Spanish / Local` format and the nav line. The `**Primary Geographic Zone:**` and `**Liquid & Texture Profile:**` labels may stay in English. Texture, provinces and filters always come from the English source.
- `bun i18n-status.ts [lang]` lists missing and stale translations. A missing page shows the English text with a notice. A stale page (English changed after translating) shows the translation with an "may be out of date" notice.
