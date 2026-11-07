// Per-language view model + Markdown rendering shared by all pages.
import { marked } from "marked";
import { panSVG } from "@arros/pans";
import { LANGS, DEFAULT_LANG, loadLang, provName, provSlug, regionLabel, stripMd, type Lang, type Page } from "@arros/content";
import { UI, HTML_LANG } from "./i18n";
import { areaView, areaIds, regionArea, recipeArea, type AreaView } from "./areas";
import { adHtml } from "./ads";

export { LANGS, DEFAULT_LANG, HTML_LANG, provSlug, recipeArea, type Lang, type Page, type AreaView };
export { isRtl } from "@arros/content";
export type Key = keyof (typeof UI)["en"];

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const tr = (lang: Lang, k: Key, vars: Record<string, string | number> = {}) =>
  UI[lang][k].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ""));
export const nDishes = (lang: Lang, n: number) => tr(lang, n === 1 ? "dish" : "dishes", { n });

/** "/" for English, "/es/" etc. for the others. */
export const langBase = (lang: Lang) => (lang === DEFAULT_LANG ? "/" : `/${lang}/`);
/** getStaticPaths param for the [...lang] rest segment. */
export const langParam = (lang: Lang) => (lang === DEFAULT_LANG ? undefined : lang);
export const langFromParam = (p: string | undefined): Lang => (p && (LANGS as readonly string[]).includes(p) ? (p as Lang) : DEFAULT_LANG);
export const langPaths = () => LANGS.map((lang) => ({ params: { lang: langParam(lang) }, props: { lang } }));

export const VESSEL: Record<string, string> = { paella: "Paella", cassola: "Cassola", caldero: "Caldero", olla: "Olla", tray: "Siniyyeh", tanjara: "Tanjara" };
// The vessel names are Spanish/Valencian words; explain them in the reader's language.
const VESSEL_L: Record<Lang, Record<string, string>> = {
  en: { paella: "Paella pan", cassola: "Clay casserole", caldero: "Iron cauldron", olla: "Stew pot", tray: "Serving tray", tanjara: "Copper pot" },
  es: { paella: "Paella", cassola: "Cazuela de barro", caldero: "Caldero", olla: "Olla", tray: "Bandeja", tanjara: "Olla de cobre" },
  ca: { paella: "Paella", cassola: "Cassola de fang", caldero: "Calder", olla: "Olla", tray: "Safata", tanjara: "Olla de coure" },
  th: { paella: "กระทะปาเอยา", cassola: "หม้อดินเผา", caldero: "หม้อเหล็กหล่อ", olla: "หม้อตุ๋น", tray: "ถาดเสิร์ฟ", tanjara: "หม้อทองแดง" },
  ar: { paella: "مقلاة الباييلا", cassola: "طاجن فخّار", caldero: "قِدر حديد", olla: "قِدر", tray: "صينية", tanjara: "طنجرة نحاس" },
};
export const vesselLabel = (lang: Lang, v: string) => VESSEL_L[lang]?.[v] ?? VESSEL[v] ?? v;
const TEX_KEY = { seco: "chipSeco", meloso: "chipMeloso", caldoso: "chipCaldoso" } as const;
export const texLabel = (lang: Lang, tex: string) => (tex in TEX_KEY ? tr(lang, TEX_KEY[tex as keyof typeof TEX_KEY]) : "");
export const shortTex = (lang: Lang, tex: keyof typeof TEX_KEY) => tr(lang, TEX_KEY[tex]).split(" · ")[0];
export const vtName = (prefix: string, slug: string) => `${prefix}-${slug}`.slice(0, 120);

export function panHtml(p: Page, opts: { steam?: boolean; cls?: string; label?: boolean } = {}) {
  return p.spec ? panSVG(p.spec, p.slug, { steam: opts.steam, cls: opts.cls, label: opts.label ? p.title : undefined }) : "";
}

// ---------- per-language site model ----------
export interface SiteModel {
  lang: Lang;
  pages: Page[];
  byFile: Map<string, Page>;
  recipes: Page[];
  regions: { file: string; name: string; slug: string; recipes: Page[]; page?: Page; area?: string }[];
  /** Areas in glosses.json order, with their regions and recipes (empty areas included: "coming soon"). */
  areas: (AreaView & { regionList: SiteModel["regions"]; recipes: Page[] })[];
  regionName: (file: string, fallback: string) => string;
  areaOfRecipe: (p: Page) => string | undefined;
}
const models = new Map<Lang, SiteModel>();
export function site(lang: Lang): SiteModel {
  const hit = models.get(lang);
  if (hit) return hit;
  const pages = loadLang(lang);
  const byFile = new Map(pages.map((p) => [p.file, p]));
  const recipes = pages.filter((p) => p.kind === "recipe").sort((a, b) => a.title.localeCompare(b.title, "es"));
  const regionName = (file: string, fallback: string) => {
    // A curated name in the reader's language (content/glosses.json) beats any Markdown spelling.
    const label = regionLabel(file, lang);
    if (label) return label;
    const p = byFile.get(file);
    // The region page's own title wins (recipes spell regions inconsistently in their nav lines).
    return provName(p && p.status !== "missing" ? p.title : fallback);
  };
  const refs = new Map<string, string>();
  for (const r of recipes) for (const x of r.provinces) if (!refs.has(x.file)) refs.set(x.file, x.name);
  for (const p of pages) if (p.kind === "province" && !refs.has(p.file)) refs.set(p.file, p.title);
  const regions = [...refs.entries()].map(([file, name]) => ({
    file, name: regionName(file, name), slug: provSlug(file), page: byFile.get(file),
    recipes: recipes.filter((r) => r.provinces.some((x) => x.file === file)),
    area: regionArea(file),
  }));
  const areas = areaIds().map((id) => {
    const v = areaView(id, lang)!;
    const regionList = regions.filter((r) => r.area === id);
    return { ...v, regionList, recipes: recipes.filter((r) => recipeArea(r) === id) };
  });
  const m: SiteModel = { lang, pages, byFile, recipes, regions, areas, regionName, areaOfRecipe: recipeArea };
  models.set(lang, m);
  return m;
}

// ---------- Markdown → HTML ----------
// Each "## " section is rendered and wrapped separately so section 4 (the recipe) gets cooking tools
// and every section can animate in. Heading anchors keep any letter so Thai headings work.
const anchorId = (s: string) =>
  stripMd(s).normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

export function renderPage(page: Page, m: SiteModel, opts: { appendToSection?: Record<string, string> } = {}) {
  const lang = m.lang;
  const base = langBase(lang);
  const headings: { id: string; text: string; num?: string }[] = [];
  const used = new Set<string>();
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth, text }) {
    const inner = this.parser.parseInline(tokens);
    const clean = stripMd(text).replace(/^\d+\.\s*/, "").replace(/\s*\(Crucial\)$/i, "");
    let id = anchorId(clean) || "section";
    while (used.has(id)) id += "-x";
    used.add(id);
    const num = depth === 2 ? text.match(/^(\d+)\./)?.[1] : undefined;
    if (depth === 2) headings.push({ id, text: clean, num });
    const shown = depth === 2 ? `${num ? `<span class="h-num">${num.padStart(2, "0")}</span>` : ""}${esc(clean)}` : inner;
    return `<h${depth} id="${id}"><a class="anchor" href="#${id}">${shown}</a></h${depth}>\n`;
  };
  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const tt = title ? ` title="${esc(title)}"` : "";
    const local = href.match(/^([\w.-]+\.md)(#.*)?$/);
    if (local) {
      const target = m.byFile.get(local[1]);
      if (target) return `<a href="${base}${target.url}${local[2] ?? ""}"${tt}>${text}</a>`;
      return `<span class="missing-link" title="${esc(tr(lang, "missingLink"))}">${text}</span>`;
    }
    const ext = /^https?:/.test(href) ? ` target="_blank" rel="noopener"` : "";
    return `<a href="${esc(href)}"${tt}${ext}>${text}</a>`;
  };
  renderer.table = function (token) {
    return `<div class="table-wrap">${marked.Renderer.prototype.table.call(this, token)}</div>`;
  };
  const chunks = page.body.split(/^(?=## )/m);
  let adsPlaced = 0;
  const html = chunks.map((chunk, i) => {
    const num = chunk.match(/^## (\d+)\./)?.[1];
    // §6 "Related Dishes" is legacy generated text; recipe pages render families.json instead.
    if (num === "6" && page.kind === "recipe") return "";
    const inner = marked.parse(chunk, { renderer, gfm: true, async: false }) as string;
    if (!inner.trim()) return "";
    const cls = num === "4" && page.kind === "recipe" ? " sec-recipe" : !chunk.startsWith("## ") ? " sec-intro" : "";
    // Never inside the recipe itself: after the history (2) and after the recipe (4); max two per page.
    const adHere = adsPlaced < 2 && i < chunks.length - 1 && (page.kind === "recipe" ? num === "2" || num === "4" : i === 2 || i === 6);
    if (adHere) adsPlaced++;
    const extra = num ? opts.appendToSection?.[num] ?? "" : "";
    return `<section class="sec${cls}"${num ? ` data-sec="${num}"` : ""} data-reveal>${inner}${extra}</section>${adHere ? adHtml("inArticle", tr(lang, "advertisement")) : ""}`;
  }).join("\n");
  return { html, headings };
}
