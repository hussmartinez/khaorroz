// IndexNow (Bing, Yandex, Seznam, Naver…; Bing feeds ChatGPT search / Copilot): after a deploy,
// submit the URLs that changed. Content changes → those pages in every language; app changes →
// every URL in the sitemap. Usage: bun scripts/indexnow.ts <base-commit>   (run from repo root)
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
const HOST = "khaorroz.forfreedom.app";
const KEY = readFileSync("scripts/.indexnow-key", "utf8").trim();
const base = process.argv[2];
const sitemap = existsSync("apps/web/dist/sitemap-0.xml") ? readFileSync("apps/web/dist/sitemap-0.xml", "utf8") : "";
const all = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
let changed: string[] = [];
try { changed = base && !/^0+$/.test(base) ? execSync(`git diff --name-only ${base} HEAD`, { encoding: "utf8" }).split("\n").filter(Boolean) : []; } catch { changed = []; }
const appChanged = !base || /^0+$/.test(base) || changed.some((f) => /^(apps|packages)\//.test(f));
let urls: string[];
if (appChanged) urls = all;
else {
  const slugs = changed.filter((f) => /^content\/(i18n\/\w+\/)?(recipe|provincial)_.+\.md$/.test(f))
    .map((f) => f.split("/").pop()!.replace(/\.md$/, "").replace(/^(recipe|provincial)_/, "").replace(/_/g, "-"));
  urls = all.filter((u) => slugs.some((s) => u.endsWith(`/${s}`) || u.endsWith(`/${s}.html`)));
}
urls = [...new Set(urls)].slice(0, 10000);
if (!urls.length) { console.log("indexnow: nothing to submit"); process.exit(0); }
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`indexnow: submitted ${urls.length} URLs → HTTP ${res.status}`);
