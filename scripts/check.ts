// Validates the content (same checks the build runs) without building. Exit code 1 on problems.
import { loadEnglish, loadLang, LANGS, problems, CONTENT_DIR } from "@arros/content";
try {
  const en = loadEnglish();
  for (const l of LANGS) loadLang(l);
  console.log(`✓ ${en.filter((p) => p.kind === "recipe").length} recipes, ${en.length} pages OK in ${CONTENT_DIR}`);
  for (const p of problems) console.warn(`  ! ${p}`);
} catch (e) {
  console.error(String((e as Error).message));
  process.exit(1);
}
