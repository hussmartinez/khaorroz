// /llms-full.txt: the whole English corpus (history + every recipe) as clean Markdown.
import type { APIRoute } from "astro";
import { site } from "../lib/site";
import { pageUrl } from "../lib/seo";
import { withoutRelated } from "@arros/content";

export const GET: APIRoute = () => {
  const m = site("en");
  const parts = ["# Khaorroz — full corpus (English)\n", "Traditional rice dishes of Spain and Bilad al-Sham: history, variations and sourced recipes. Canonical URLs are given for each document.\n"];
  const hist = m.byFile.get("history.md");
  if (hist) parts.push(`\n---\n\n# ${hist.title}\n\nURL: ${pageUrl("en", hist.url)}\n\n${hist.body.trim()}\n`);
  for (const a of m.areas) for (const p of a.recipes)
    parts.push(`\n---\n\n# ${p.title}${p.altTitle ? ` / ${p.altTitle}` : ""}\n\nURL: ${pageUrl("en", p.url)}\nArea: ${a.name} · Regions: ${p.provinces.map((x) => m.regionName(x.file, x.name)).join(", ")}${p.gloss ? `\nIn short: ${p.gloss}` : ""}\n\n${withoutRelated(p.body).trim()}\n`);
  return new Response(parts.join(""), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
