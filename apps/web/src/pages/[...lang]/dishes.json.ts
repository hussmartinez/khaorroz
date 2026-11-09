// Compact per-language dish index for client features (saved / recently viewed): /dishes.json, /es/dishes.json …
import type { APIRoute } from "astro";
import { getImage } from "astro:assets";
import { LANGS, langParam, langBase, site, type Lang } from "../../lib/site";
import { dishPhoto } from "../../lib/photos";
export function getStaticPaths() { return LANGS.map((lang) => ({ params: { lang: langParam(lang) }, props: { lang } })); }
export const GET: APIRoute = async ({ props }) => {
  const { lang } = props as { lang: Lang };
  const m = site(lang);
  const base = langBase(lang);
  const items = await Promise.all(m.recipes.map(async (p) => {
    const ph = dishPhoto(p.file, lang, p.title);
    const img = ph ? (await getImage({ src: ph.meta, width: 160, format: "webp" })).src : `/pans/${p.slug}.svg`;
    const area = m.areas.find((a) => a.id === m.areaOfRecipe(p));
    return { slug: p.slug, title: p.title, local: p.altTitle !== p.title ? p.altTitle : "", gloss: p.gloss, url: `${base}${p.url}`,
      region: p.provinces[0] ? m.regionName(p.provinces[0].file, p.provinces[0].name) : "", area: area?.short ?? "", theme: area?.theme ?? "", img, photo: !!ph };
  }));
  return new Response(JSON.stringify(items), { headers: { "Content-Type": "application/json" } });
};
