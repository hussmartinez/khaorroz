// Markdown twin of every recipe page (/recipes/x.md, /es/recipes/x.md …) for LLM fetchers.
import type { APIRoute } from "astro";
import { LANGS, langParam, site, type Lang } from "../../../lib/site";
import { pageUrl } from "../../../lib/seo";
import { withoutRelated } from "@arros/content";

export function getStaticPaths() {
  return LANGS.flatMap((lang) => site(lang).recipes.map((p) => ({ params: { lang: langParam(lang), slug: p.slug }, props: { lang, file: p.file } })));
}
export const GET: APIRoute = ({ props }) => {
  const { lang, file } = props as { lang: Lang; file: string };
  const m = site(lang);
  const p = m.byFile.get(file)!;
  const head = `# ${p.title}${p.altTitle ? ` / ${p.altTitle}` : ""}\n\n> Source: Khaorroz — ${pageUrl(lang, p.url)}${p.gloss ? `\n> ${p.gloss}` : ""}${p.status === "missing" ? "\n> (Not yet translated: English original.)" : ""}\n\n`;
  return new Response(head + withoutRelated(p.body).trim() + "\n", { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
