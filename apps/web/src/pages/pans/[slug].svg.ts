// Standalone, cacheable pan illustration per dish (/pans/<slug>.svg). Cards and lists reference
// these with <img> instead of inlining ~8 KB of SVG each; hero illustrations stay inline (animated).
import type { APIRoute } from "astro";
import { panSVG } from "@arros/pans";
import { site } from "../../lib/site";

export function getStaticPaths() {
  return site("en").recipes.filter((p) => p.spec).map((p) => ({ params: { slug: p.slug }, props: { file: p.file } }));
}
export const GET: APIRoute = ({ props }) => {
  const p = site("en").byFile.get((props as { file: string }).file)!;
  const svg = panSVG(p.spec!, p.slug, { steam: false })
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="228" height="228" ');
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
};
