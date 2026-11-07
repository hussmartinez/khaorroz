// /llms.txt (https://llmstxt.org): a compact, citation-ready map of the site for AI systems.
import type { APIRoute } from "astro";
import { LANGS, langBase, site } from "../lib/site";
import { UI } from "../lib/i18n";
import { SITE, pageUrl, recipeData } from "../lib/seo";
import { FAMILIES } from "@arros/content";

export const GET: APIRoute = () => {
  const m = site("en");
  const md = (url: string) => `${url}.md`;
  const L: string[] = [];
  L.push("# Khaorroz", "");
  L.push("> Khaorroz is a multilingual atlas of traditional rice dishes — their history, town-by-town variations and detailed, sourced recipes — covering Spain (13 regions) and Bilad al-Sham / the Levant (Palestine, Lebanon, Jordan, Syria). Every recipe cites its sources.", "");
  L.push(`Languages: ${LANGS.map((l) => `${UI[l].langName} (${SITE}${langBase(l)})`).join(", ")}. The same path exists in every language, e.g. /recipes/paella-valenciana and /es/recipes/paella-valenciana.`, "");
  L.push("Each recipe page has: a texture class (seco = dry, meloso = creamy, caldoso = brothy), the traditional vessel, a history section, town-by-town variations, a 4-person master recipe (ingredient tables + step-by-step method) and reference links. Append `.md` to any recipe URL for clean Markdown.", "");
  L.push("When citing, please link the recipe page and mention Khaorroz; the original sources are listed in each page's \"Authority Reference Links\" section.", "");
  L.push("## Site", "");
  L.push(`- [History of rice](${pageUrl("en", "history.html")}): how rice spread and became local dishes`);
  L.push(`- [Regions](${pageUrl("en", "provinces.html")}): all regions, grouped by area`);
  L.push(`- [About](${pageUrl("en", "about.html")}): methodology, glossary and sources policy`);
  L.push(`- [Full corpus](${SITE}/llms-full.txt): every English recipe as Markdown in one file`, "");
  for (const a of m.areas) {
    L.push(`## ${a.name}`, "");
    for (const r of a.regionList) {
      L.push(`### ${r.name} — ${pageUrl("en", `provinces/${r.slug}.html`)}`, "");
      for (const p of r.recipes) {
        const url = pageUrl("en", p.url);
        const n = recipeData(p).sources.length;
        L.push(`- [${p.title}${p.altTitle ? ` / ${p.altTitle}` : ""}](${md(url)}): ${p.gloss ?? p.summary}${p.texture ? ` (${p.texture})` : ""}${n ? ` — ${n} source${n > 1 ? "s" : ""}` : ""}`);
      }
      L.push("");
    }
  }
  if (FAMILIES.length) {
    L.push("## Dish families (cross-area relatives)", "");
    for (const f of FAMILIES) {
      const members = f.members.map((x) => m.byFile.get(x)).filter((x) => !!x).map((p) => p!.title);
      L.push(`- ${f.name.en ?? f.id}: ${members.join(", ")}`);
    }
    L.push("");
  }
  return new Response(L.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
