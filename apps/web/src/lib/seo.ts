// SEO: per-language titles/descriptions written for search intent, and schema.org JSON-LD.
// Everything is derived from the content model (Page + recipeData + areas), so a future CMS can
// produce identical URLs and structured data.
import { recipeData, contentDates, photoFor, type Page } from "@arros/content";
import { langBase, tr, type Lang, type SiteModel } from "./site";

export const SITE = (import.meta.env.SITE ?? "https://khaorroz.forfreedom.app").replace(/\/$/, "");
export const BRAND = "Khaorroz";
export const abs = (path: string) => `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
/** Canonical (clean) URL of a page path relative to a language root. */
export const pageUrl = (lang: Lang, path: string) =>
  abs(`${langBase(lang)}${path.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "")}`);

export const OG_LOCALE: Record<Lang, string> = { en: "en_US", es: "es_ES", ca: "ca_ES", th: "th_TH", ar: "ar_AR" };

// ---------- titles & descriptions ----------
const RECIPE_WORD: Record<Lang, string> = { en: "Recipe", es: "Receta", ca: "Recepta", th: "สูตร", ar: "وصفة" };
const TEXTURE: Record<Lang, Record<string, string>> = {
  en: { seco: "dry", meloso: "creamy", caldoso: "brothy" },
  es: { seco: "seco", meloso: "meloso", caldoso: "caldoso" },
  ca: { seco: "sec", meloso: "melós", caldoso: "caldós" },
  th: { seco: "แห้ง", meloso: "ข้นนุ่ม", caldoso: "มีน้ำซุป" },
  ar: { seco: "جاف", meloso: "طريّ", caldoso: "بمرق" },
};
const clamp = (s: string, n: number) => {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:·—-]+$/, "") + "…";
};
const noDot = (s: string) => s.trim().replace(/[.。]+$/, "");

/** "{Name} — {gloss} | {Recipe} | Khaorroz", shortened to ≈65 characters when needed. */
export function recipeTitle(p: Page, lang: Lang) {
  const g = noDot(p.gloss ?? "");
  const word = RECIPE_WORD[lang];
  const full = g ? `${p.title} — ${g} | ${word} | ${BRAND}` : `${p.title} | ${word} | ${BRAND}`;
  if (full.length <= 65 || !g) return full;
  const short = `${p.title} — ${g} | ${BRAND}`;
  if (short.length <= 65) return short;
  const room = 65 - `${p.title} —  | ${BRAND}`.length;
  return room > 12 ? `${p.title} — ${clamp(g, room)} | ${BRAND}` : `${p.title} | ${word} | ${BRAND}`;
}

export function recipeDescription(p: Page, lang: Lang, region: string, facet?: string) {
  const g = noDot(p.gloss ?? "");
  const f = facet ? ` (${facet})` : "";
  const tpl: Record<Lang, string> = {
    en: `Traditional ${p.title} recipe${g ? `: ${g}` : ""}. From ${region}${f}, with town-by-town variations, history and sources.`,
    es: `Receta tradicional de ${p.title}${g ? `: ${g}` : ""}. De ${region}${f}, con variantes pueblo a pueblo, historia y fuentes.`,
    ca: `Recepta tradicional de ${p.title}${g ? `: ${g}` : ""}. De ${region}${f}, amb variants poble a poble, història i fonts.`,
    th: `สูตร${p.title}แบบดั้งเดิม${g ? `: ${g}` : ""} จาก${region}${f} พร้อมความต่างของแต่ละท้องถิ่น ประวัติ และแหล่งอ้างอิง`,
    ar: `وصفة ${p.title} التقليدية${g ? `: ${g}` : ""}. من ${region}${f}، مع اختلافات كل بلدة وتاريخه ومصادره.`,
  };
  return clamp(tpl[lang], 155);
}

const REGION_TITLE: Record<Lang, (r: string) => string> = {
  en: (r) => `Rice dishes of ${r}: traditional recipes`,
  es: (r) => `Arroces de ${r}: recetas tradicionales`,
  ca: (r) => `Arrossos de ${r}: receptes tradicionals`,
  th: (r) => `อาหารข้าวของ${r}: สูตรดั้งเดิม`,
  ar: (r) => `أطباق الأرز في ${r}: وصفات تقليدية`,
};
export const regionTitle = (lang: Lang, region: string) => `${REGION_TITLE[lang](region)} | ${BRAND}`;
export function regionDescription(lang: Lang, region: string, dishes: Page[], summary?: string) {
  const names = dishes.slice(0, 3).map((d) => d.title).join(", ");
  const tpl: Record<Lang, string> = {
    en: `${dishes.length} traditional rice dishes from ${region}${names ? `, including ${names}` : ""}: history, town variations and detailed recipes.`,
    es: `${dishes.length} arroces tradicionales de ${region}${names ? `, como ${names}` : ""}: historia, variantes locales y recetas detalladas.`,
    ca: `${dishes.length} arrossos tradicionals de ${region}${names ? `, com ${names}` : ""}: història, variants locals i receptes detallades.`,
    th: `อาหารข้าวดั้งเดิม ${dishes.length} เมนูจาก${region}${names ? ` เช่น ${names}` : ""}: ประวัติ ความต่างของแต่ละท้องถิ่น และสูตรละเอียด`,
    ar: `${dishes.length} من أطباق الأرز التقليدية في ${region}${names ? `، منها ${names}` : ""}: التاريخ والاختلافات المحلية ووصفات مفصّلة.`,
  };
  return clamp(dishes.length ? tpl[lang] : summary ?? tpl[lang], 155);
}
export const plainTitle = (s: string) => s.replace(/<br>/g, " ").replace(/\s+/g, " ").trim();

// ---------- JSON-LD ----------
type LD = Record<string, unknown>;
export const ORG_ID = `${SITE}/#org`;
export const organization = (): LD => ({
  "@type": "Organization", "@id": ORG_ID, name: BRAND, url: `${SITE}/`,
  logo: { "@type": "ImageObject", url: abs("/icons/icon-512.png"), width: 512, height: 512 },
});
export const website = (lang: Lang): LD => ({
  "@type": "WebSite", "@id": `${SITE}/#website`, url: abs(langBase(lang)), name: BRAND, inLanguage: lang,
  publisher: { "@id": ORG_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${abs(langBase(lang))}?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});
export const breadcrumbs = (items: [string, string][]): LD => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })),
});
export const itemList = (pages: Page[], lang: Lang): LD => ({
  "@type": "ItemList",
  itemListElement: pages.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: pageUrl(lang, p.url), name: p.title })),
});

/** Images for a recipe: the photo (if any), a 16:9 card and a 1:1 illustration (Google wants several ratios). */
export function recipeImages(p: Page, lang: Lang, photoUrl?: string) {
  return [photoUrl, abs(`/og/${lang}/${p.slug}.jpg`), abs(`/og/sq/${p.slug}.jpg`)].filter(Boolean) as string[];
}

export function recipeLD(p: Page, m: SiteModel, opts: { url: string; description: string; photoUrl?: string; cuisine: string[]; facet?: string }): LD {
  const d = recipeData(p);
  const dates = contentDates(p.file);
  const lang = m.lang;
  const regions = p.provinces.map((x) => m.regionName(x.file, x.name));
  const keywords = [p.title, p.altTitle, p.gloss, opts.facet, ...regions, ...opts.cuisine]
    .filter(Boolean).map((k) => noDot(String(k)));
  return {
    "@type": "Recipe",
    "@id": `${opts.url}#recipe`,
    name: p.title,
    ...(p.altTitle ? { alternateName: p.altTitle } : {}),
    description: [p.gloss && noDot(p.gloss) + ".", p.summary].filter(Boolean).join(" "),
    image: recipeImages(p, lang, opts.photoUrl),
    url: opts.url,
    mainEntityOfPage: opts.url,
    inLanguage: lang,
    recipeCuisine: opts.cuisine.join(", "),
    recipeCategory: p.spec?.base === "leche" ? "Dessert" : "Main course",
    keywords: [...new Set(keywords)].join(", "),
    recipeYield: "4",
    ...(d.ingredients.length ? { recipeIngredient: d.ingredients } : {}),
    ...(d.steps.length ? { recipeInstructions: d.steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })) } : {}),
    datePublished: dates.published,
    dateModified: dates.modified,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    ...(d.sources.length ? {
      citation: d.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
      isBasedOn: d.sources.map((s) => s.url),
    } : {}),
  };
}

export const graph = (...nodes: LD[]) => ({ "@context": "https://schema.org", "@graph": nodes });
export { photoFor, recipeData, tr };
