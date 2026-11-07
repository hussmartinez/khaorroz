// Lists which pages need translating (missing) or re-translating (stale) per language.
// Usage: bun i18n-status.ts [lang]   → prints "<lang> <status> <file> <source_hash>"
// A translation file is i18n/<lang>/<file> and must start with:
//   ---
//   source_hash: <hash printed here>
//   ---
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { LANGS, DEFAULT_LANG } from "./i18n";

const ROOT = join(import.meta.dir, "..");
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const only = process.argv[2];
const files = readdirSync(ROOT).filter((f) => /^(recipe_.*|provincial_.*|history|README)\.md$/.test(f)).sort();
let todo = 0;
for (const lang of LANGS) {
  if (lang === DEFAULT_LANG || (only && lang !== only)) continue;
  for (const f of files) {
    const h = hash(readFileSync(join(ROOT, f), "utf8"));
    const tf = join(ROOT, "i18n", lang, f);
    const status = !existsSync(tf) ? "missing"
      : readFileSync(tf, "utf8").match(/^---\n[\s\S]*?source_hash:\s*(\w+)/)?.[1] === h ? "ok" : "stale";
    if (status !== "ok") { todo++; console.log(`${lang}\t${status}\t${f}\t${h}`); }
  }
}
console.error(`${todo} translation(s) to do`);
