// One-time migration (2026-11-07): translations that are up to date get their `source_hash` rewritten
// to the new hash (English source minus the legacy "## 6. Related Dishes" section), so that section
// can later be removed from the English files without marking translations stale.
// Stale translations are left alone (they stay stale). Safe to re-run.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_DIR, I18N_DIR, LANGS, DEFAULT_LANG, sourceHash, legacySourceHash } from "@arros/content";
let changed = 0, already = 0, stale = 0;
for (const lang of LANGS) {
  if (lang === DEFAULT_LANG) continue;
  const dir = join(I18N_DIR, lang);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) {
    const srcFile = join(CONTENT_DIR, f);
    if (!existsSync(srcFile)) continue;
    const src = readFileSync(srcFile, "utf8");
    const tf = join(dir, f);
    const t = readFileSync(tf, "utf8");
    const m = t.match(/^(---\n[\s\S]*?source_hash:\s*)(\w+)/);
    if (!m) continue;
    if (m[2] === sourceHash(src)) { already++; continue; }
    if (m[2] !== legacySourceHash(src)) { stale++; continue; }
    writeFileSync(tf, t.replace(m[0], m[1] + sourceHash(src)));
    changed++;
  }
}
console.log(`source_hash migration: ${changed} rewritten, ${already} already new, ${stale} stale (left as is)`);
