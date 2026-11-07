// Lists pages that need translating (missing) or re-translating (stale) per language.
// Usage: bun scripts/i18n-status.ts [lang]   → "<lang>\t<status>\t<file>\t<source_hash>"
// A translation is content/i18n/<lang>/<same file name> and must start with
//   ---
//   source_hash: <hash printed here>
//   ---
import { LANGS, DEFAULT_LANG, translationStatus } from "@arros/content";
const only = process.argv[2];
let todo = 0;
for (const lang of LANGS) {
  if (lang === DEFAULT_LANG || (only && lang !== only)) continue;
  for (const r of translationStatus(lang)) if (r.status !== "ok") { todo++; console.log(`${lang}\t${r.status}\t${r.file}\t${r.hash}`); }
}
console.error(`${todo} translation(s) to do`);
