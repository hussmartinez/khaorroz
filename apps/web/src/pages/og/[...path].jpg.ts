// Build-time social images: /og/<lang>/<slug>.jpg (16:9 per recipe), /og/<lang>/_home.jpg,
// /og/<lang>/_area-<id>.jpg and /og/sq/<slug>.jpg (1:1 illustration for Recipe JSON-LD).
import type { APIRoute } from "astro";
import sharp from "sharp";
import { LANGS, site, tr, texLabel, type Lang } from "../../lib/site";
import { plainTitle } from "../../lib/seo";
import { recipeCard, squareCard, collageCard, type Theme } from "../../lib/og";

type Props = { kind: "recipe" | "sq" | "home" | "area"; lang: Lang; file?: string; area?: string };
export function getStaticPaths() {
  const paths: { params: { path: string }; props: Props }[] = [];
  for (const lang of LANGS) {
    const m = site(lang);
    paths.push({ params: { path: `${lang}/_home` }, props: { kind: "home", lang } });
    for (const a of m.areas) paths.push({ params: { path: `${lang}/_area-${a.id}` }, props: { kind: "area", lang, area: a.id } });
    for (const p of m.recipes) paths.push({ params: { path: `${lang}/${p.slug}` }, props: { kind: "recipe", lang, file: p.file } });
  }
  for (const p of site("en").recipes) paths.push({ params: { path: `sq/${p.slug}` }, props: { kind: "sq", lang: "en", file: p.file } });
  return paths;
}

const theme = (t?: string): Theme => (t === "sham" ? "sham" : "spain");
export const GET: APIRoute = async ({ props }) => {
  const { kind, lang, file, area } = props as Props;
  const m = site(lang);
  let png: Uint8Array;
  if (kind === "recipe" || kind === "sq") {
    const p = m.byFile.get(file!)!;
    const a = m.areas.find((x) => x.id === m.areaOfRecipe(p));
    if (kind === "sq") png = squareCard(p, theme(a?.theme));
    else {
      const region = p.provinces[0] ? m.regionName(p.provinces[0].file, p.provinces[0].name) : "";
      png = recipeCard(p, lang, theme(a?.theme), a?.name ?? tr(lang, "kickerRecipe"), [region, texLabel(lang, p.texture)].filter(Boolean).join(" · "));
    }
  } else if (kind === "area") {
    const a = m.areas.find((x) => x.id === area)!;
    png = collageCard(lang, theme(a.theme), a.recipes.slice(0, 3), { kicker: a.name, title: plainTitle(a.copy.heroTitle), gloss: a.copy.heroLede });
  } else {
    const picks = ["paella-valenciana", "maqluba", "arroz-negro"].map((s) => m.recipes.find((r) => r.slug === s)).filter((x) => !!x);
    png = collageCard(lang, "spain", picks.length >= 3 ? picks : m.recipes.slice(0, 3), { kicker: tr(lang, "heroKicker"), title: plainTitle(tr(lang, "heroTitle")), gloss: tr(lang, "metaDescription") });
  }
  const jpg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg" } });
};
