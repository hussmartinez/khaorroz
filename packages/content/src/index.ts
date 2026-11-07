// @arros/content — loads the research Markdown (English sources + translations), parses the
// structure the site relies on, and validates it with zod so malformed files fail loudly.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { specFrom, type PanSpec } from "@arros/pans";

export const LANGS = ["en", "es", "ca", "th", "ar"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const RTL_LANGS: readonly Lang[] = ["ar"];
export const isRtl = (lang: Lang) => RTL_LANGS.includes(lang);

// Repo layout: <repo>/content (English) and <repo>/content/i18n/<lang>. Before the move to
// content/ the files lived in the repo root, so fall back to that.
// Found by walking up from the working directory (bundlers relocate this module, so
// import.meta.url can't be trusted to point at the repo).
function findRepo(): string {
  for (let d = process.cwd(); ; d = dirname(d)) {
    const pj = join(d, "package.json");
    if (existsSync(pj) && /"name":\s*"arros"/.test(readFileSync(pj, "utf8"))) return d;
    if (dirname(d) === d) throw new Error("@arros/content: run inside the arros repo (no package.json named 'arros' found above " + process.cwd() + ")");
  }
}
const REPO = findRepo();
export const CONTENT_DIR = process.env.ARROS_CONTENT ?? (existsSync(join(REPO, "content")) ? join(REPO, "content") : REPO);
export const I18N_DIR = join(CONTENT_DIR, "i18n");

export type Kind = "recipe" | "province" | "history" | "readme";
export type TStatus = "source" | "ok" | "stale" | "missing";
export interface Page {
  file: string;
  kind: Kind;
  slug: string;
  url: string; // relative to a language root, e.g. recipes/paella-valenciana (clean URL, no .html)
  title: string;
  altTitle: string;
  gloss: string; // plain-language 'what is this dish' in the page's language (content/glosses.json)
  body: string; // Markdown without front matter, H1 and nav line
  zone: string;
  texture: "" | "seco" | "meloso" | "caldoso";
  provinces: { name: string; file: string }[];
  summary: string;
  status: TStatus;
  spec?: PanSpec;
  minutes: number;
}

export const sourceHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
export const stripMd = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").trim();
export const slugify = (s: string) =>
  stripMd(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fileSlug = (file: string) => slugify(basename(file, ".md").replace(/^(recipe|provincial)_/, "").replace(/_/g, "-"));
export const provSlug = (file: string) => fileSlug(file);
export const provName = (n: string) => n.replace(/^Prov[ií]ncia\s+(de\s+|d')?/i, "");

// ---------- plain-language labels (content/glosses.json) ----------
// Recipe titles are authentic Spanish/local names; a reader who knows neither language needs a short
// description ("rice with rabbit and snails") in their own language, and region names in their language.
type Labels = Record<string, Partial<Record<Lang, string>>>;
const GLOSS_FILE = join(CONTENT_DIR, "glosses.json");
interface AreaDef { name: Partial<Record<Lang, string>>; regions: string[] }
const LABELS: { recipes: Labels; regions: Labels; areas: Record<string, AreaDef> } = existsSync(GLOSS_FILE)
  ? { recipes: {}, regions: {}, areas: {}, ...JSON.parse(readFileSync(GLOSS_FILE, "utf8")) }
  : { recipes: {}, regions: {}, areas: {} };
export const glossFor = (file: string, lang: Lang) => LABELS.recipes[file]?.[lang] ?? LABELS.recipes[file]?.en ?? "";
export const regionLabel = (file: string, lang: Lang) => LABELS.regions[file]?.[lang] ?? LABELS.regions[file]?.en;

// ---------- areas (glosses.json "areas"): top level above regions, e.g. Spain / Bilad al-Sham ----------
export interface Area {
  id: string;
  name: (lang: Lang) => string;
  regions: string[];
  theme?: string; // optional visual theme id (defaults to the area id)
  hero?: Partial<Record<Lang, { heroTitle: string; heroLede: string }>>; // optional area-page copy override
}
export const AREAS: Area[] = Object.entries(LABELS.areas).map(([id, a]) => ({
  id,
  name: (lang: Lang) => a.name?.[lang] ?? a.name?.en ?? id,
  regions: a.regions ?? [],
  theme: (a as any).theme,
  hero: (a as any).hero,
}));
/** Area id of a region file (provincial_x.md), or undefined if it is in no area. */
export const areaOf = (regionFile: string) => AREAS.find((a) => a.regions.includes(regionFile))?.id;

export function kindOf(file: string): Kind | null {
  if (/^recipe_.+\.md$/.test(file)) return "recipe";
  if (/^provincial_.+\.md$/.test(file)) return "province";
  if (file === "history.md") return "history";
  if (file === "README.md") return "readme";
  return null;
}

export function urlFor(kind: Kind, slug: string) {
  return { recipe: `recipes/${slug}`, province: `provinces/${slug}`, history: "history", readme: "about" }[kind];
}

export function splitFrontMatter(src: string): { meta: Record<string, string>; text: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, text: src };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, text: src.slice(m[0].length) };
}

// ---------- schema ----------
const ProvinceRef = z.object({ name: z.string().min(1), file: z.string().regex(/^provincial_[\w-]+\.md$/) });
const RecipeSchema = z.object({
  title: z.string().min(2, "H1 '# Spanish name / Local name' is missing"),
  texture: z.enum(["seco", "meloso", "caldoso"], {
    error: "the '**Liquid & Texture Profile:**' bullet must contain exactly one of Seco / Meloso / Caldoso",
  }),
  provinces: z.array(ProvinceRef).min(1, "the '> ⬅ [README](README.md) · [Region](provincial_x.md)' nav line has no region link"),
  zone: z.string().min(3, "the '**Primary Geographic Zone:**' bullet is missing"),
  body: z.string().refine((b) => /^## 4\./m.test(b), "section '## 4. …' (the master recipe) is missing"),
});
const OtherSchema = z.object({ title: z.string().min(2, "H1 title is missing") });

export class ContentError extends Error {}

// Parse one Markdown file. Structural metadata (texture, provinces, zone, illustration) of a
// translation always comes from its English source so filters and pictures match in every language.
export function parse(file: string, src: string, en?: Page): Page | null {
  const kind = kindOf(file);
  if (!kind) return null;
  const lines = src.split("\n");
  const h1i = lines.findIndex((l) => /^# /.test(l));
  const h1 = h1i >= 0 ? lines[h1i].slice(2).trim() : "";
  const [rawTitle = "", ...alt] = h1.split(" / ");
  const title = rawTitle.trim();
  let altTitle = alt.join(" / ").trim();
  // "Paella Valenciana / Paella Valenciana (Arròs a la valenciana)" → "Arròs a la valenciana"
  if (title && altTitle.startsWith(title)) altTitle = altTitle.slice(title.length).trim().replace(/^\((.*)\)$/, "$1");

  const navi = lines.findIndex((l) => /^>\s*⬅/.test(l));
  const provinces: Page["provinces"] = [];
  if (navi >= 0)
    for (const m of lines[navi].matchAll(/\[([^\]]+)\]\((provincial_[^)]+\.md)\)/g)) provinces.push({ name: m[1], file: m[2] });
  const drop = new Set([h1i, navi].filter((i) => i >= 0));
  const body = lines.filter((_, i) => !drop.has(i)).join("\n");

  const field = (label: string) => src.match(new RegExp(`\\*\\*${label}[^:*]*:\\*\\*\\s*(.+)`))?.[1].trim() ?? "";
  const zone = field("Primary Geographic Zone");
  const texture = (field("Liquid & Texture Profile").match(/\b(seco|meloso|caldoso)\b/i)?.[1] ?? "").toLowerCase() as Page["texture"];

  // Summary: opening of section 2 (history), else the first paragraph — whatever the heading language.
  const sec2 = body.split(/^## /m).find((s) => /^(2\.|.*Histor)/i.test(s));
  const scope = sec2 ? sec2.split("\n").slice(1).join("\n") : body;
  const para = scope.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^[#>|*-]/.test(p)) ?? "";
  let summary = "";
  for (const sent of stripMd(para).split(/(?<=[.!?])\s+/)) {
    if (summary && (summary + " " + sent).length > 220) break;
    summary = summary ? summary + " " + sent : sent;
  }
  if (summary.length > 260) summary = summary.slice(0, 250).replace(/\s+\S*$/, "") + "…";

  const slug = fileSlug(file);
  let spec = en?.spec;
  if (!en && kind === "recipe") {
    const sec4 = body.split(/^## /m).find((s) => /^4\./.test(s)) ?? body;
    const recipeText = sec4.split("\n").filter((l) => l.startsWith("|")).join("\n") || sec4;
    spec = specFrom({ slug, title, texture, vessel: field("Traditional Cooking Vessel"), recipeText, area: provinces[0] ? areaOf(provinces[0].file) : undefined });
  }
  return {
    file, kind, slug, url: urlFor(kind, slug), title, altTitle, gloss: "", body,
    zone: en?.zone ?? zone, texture: en?.texture ?? texture, provinces: en?.provinces ?? provinces,
    summary, status: en ? "ok" : "source", spec,
    minutes: en?.minutes ?? Math.max(1, Math.round(body.split(/\s+/).length / 220)),
  };
}

// ---------- loading (memoised per build) ----------
let enCache: Page[] | undefined;
const langCache = new Map<Lang, Page[]>();
export const problems: string[] = []; // non-fatal warnings (translations)

export function loadEnglish(): Page[] {
  if (enCache) return enCache;
  const errors: string[] = [];
  const files = readdirSync(CONTENT_DIR).filter((f) => kindOf(f)).sort();
  const pages: Page[] = [];
  for (const f of files) {
    const p = parse(f, readFileSync(join(CONTENT_DIR, f), "utf8"))!;
    p.gloss = glossFor(f, DEFAULT_LANG);
    if (p.kind === "recipe" && !p.gloss) problems.push(`${f}: no plain-language description in content/glosses.json`);
    if (p.kind === "province" && !regionLabel(f, DEFAULT_LANG)) problems.push(`${f}: no region name in content/glosses.json`);
    const res = (p.kind === "recipe" ? RecipeSchema : OtherSchema).safeParse(p);
    if (!res.success) errors.push(`${f}: ${res.error.issues.map((i) => i.message).join("; ")}`);
    pages.push(p);
  }
  // every region linked from a recipe must exist
  const names = new Set(files);
  for (const p of pages) for (const x of p.provinces)
    if (!names.has(x.file)) errors.push(`${p.file}: links to ${x.file}, which does not exist`);
  // Areas: every region should belong to one; areas may list regions still being researched.
  for (const p of pages) if (p.kind === "province" && AREAS.length && !areaOf(p.file))
    problems.push(`${p.file}: region is in no area (add it to "areas" in glosses.json)`);
  for (const a of AREAS) for (const f of a.regions) if (!names.has(f))
    problems.push(`glosses.json: area "${a.id}" lists ${f}, which does not exist yet`);
  if (!pages.some((p) => p.kind === "recipe")) errors.push(`no recipe_*.md files found in ${CONTENT_DIR}`);
  if (errors.length) throw new ContentError(`Content check failed (${errors.length}):\n  - ${errors.join("\n  - ")}`);
  return (enCache = pages);
}

export function loadLang(lang: Lang): Page[] {
  if (lang === DEFAULT_LANG) return loadEnglish();
  const hit = langCache.get(lang);
  if (hit) return hit;
  const pages = loadEnglish().map((ep): Page => {
    const tf = join(I18N_DIR, lang, ep.file);
    if (!existsSync(tf)) return { ...ep, gloss: glossFor(ep.file, lang), status: "missing" };
    const { meta, text } = splitFrontMatter(readFileSync(tf, "utf8"));
    const p = parse(ep.file, text, ep)!;
    p.gloss = glossFor(ep.file, lang);
    if (!p.title) { problems.push(`i18n/${lang}/${ep.file}: no H1 title, using the English one`); p.title = ep.title; }
    p.status = meta.source_hash === sourceHash(readFileSync(join(CONTENT_DIR, ep.file), "utf8")) ? "ok" : "stale";
    return p;
  });
  langCache.set(lang, pages);
  return pages;
}

export function translationStatus(lang: Lang) {
  const out: { file: string; status: TStatus; hash: string }[] = [];
  for (const f of readdirSync(CONTENT_DIR).filter((f) => kindOf(f)).sort()) {
    const hash = sourceHash(readFileSync(join(CONTENT_DIR, f), "utf8"));
    const tf = join(I18N_DIR, lang, f);
    const status: TStatus = !existsSync(tf) ? "missing" : splitFrontMatter(readFileSync(tf, "utf8")).meta.source_hash === hash ? "ok" : "stale";
    out.push({ file: f, status, hash });
  }
  return out;
}

// ---------- structured recipe data (JSON-LD, llms.txt, a future CMS schema) ----------
// Derived from the Markdown conventions: §4 tables = ingredients, §4 ordered list = method,
// §5 links = sources. Works on translations too (section numbers are language-neutral).
export interface Source { title: string; url: string }
export interface RecipeData { ingredients: string[]; steps: string[]; sources: Source[] }

const section = (body: string, n: number) => {
  const m = body.split(/^(?=## )/m).find((s) => new RegExp(`^## ${n}\\.`).test(s));
  return m ? m.replace(/^## .*\n/, "") : "";
};
const plain = (s: string) => stripMd(s).replace(/\s+/g, " ").replace(/<[^>]+>/g, "").trim();
const RICE = /\b(rice|arroz|arròs|arros)\b|ข้าว|أرز|رز/i;

export function recipeData(p: Page): RecipeData {
  const s4 = section(p.body, 4);
  const ingredients: string[] = [];
  const lines = s4.split("\n");
  // group consecutive "|" lines into tables: header row, separator row, data rows
  const tables: string[][] = [];
  let cur: string[] | null = null;
  for (const l of lines) {
    if (l.trim().startsWith("|")) (cur ??= (tables.push([]), tables[tables.length - 1])).push(l.trim());
    else cur = null;
  }
  for (const t of tables) {
    const rows = t.map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => plain(c)));
    if (rows.length < 3) continue;
    const cols = rows[0].length;
    for (const r of rows.slice(2)) {
      const [name, qty] = r;
      if (!name || /^[-:\s]+$/.test(name)) continue;
      if (cols >= 3 && !RICE.test(name)) continue; // ratio tables: keep only the rice line
      ingredients.push(qty && !/^[-–—]$/.test(qty) ? `${qty} ${name}` : name);
    }
  }
  // method: ordered lists in §4; the last list is the step-by-step blueprint, prefer it when substantial
  const lists: string[][] = [];
  let inList = false;
  for (const line of lines) {
    const top = line.match(/^\d+\.\s+(.*)$/);
    const sub = line.match(/^\s+(?:[*-]|\d+\.)\s+(.*)$/);
    if (top) { if (!inList) lists.push([]); inList = true; lists[lists.length - 1].push(plain(top[1])); }
    else if (sub && inList) { const l = lists[lists.length - 1]; l[l.length - 1] += " " + plain(sub[1]); }
    else if (line.trim() && !sub) inList = false;
  }
  const last = lists[lists.length - 1] ?? [];
  const steps = last.length >= 3 ? last : lists.flat();
  const sources: Source[] = [];
  for (const m of section(p.body, 5).matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) sources.push({ title: plain(m[1]), url: m[2] });
  return { ingredients, steps, sources };
}

// ---------- first/last commit date per content file (falls back to "now") ----------
let datesCache: Map<string, { published: string; modified: string }> | undefined;
export function contentDates(file: string) {
  if (!datesCache) {
    datesCache = new Map();
    try {
      const { execSync } = require("node:child_process") as typeof import("node:child_process");
      const out = execSync(`git log --format=@%cI --name-only -- .`, { cwd: CONTENT_DIR, encoding: "utf8", maxBuffer: 64 << 20 });
      let date = "";
      for (const line of out.split("\n")) {
        if (line.startsWith("@")) { date = line.slice(1); continue; }
        const f = line.trim().split("/").pop();
        if (!f || !date) continue;
        const cur = datesCache.get(f);
        if (!cur) datesCache.set(f, { published: date, modified: date }); // newest first
        else cur.published = date; // keep walking back to the first commit
      }
    } catch { /* not a git checkout */ }
  }
  const now = new Date().toISOString();
  return datesCache.get(file) ?? { published: now, modified: now };
}

// ---------- photos (content/images.json + content/images/*.webp) ----------
export interface Photo {
  file: string; width: number; height: number; commonsTitle?: string; source?: string;
  author?: string; license?: string; licenseUrl?: string; alt?: Partial<Record<Lang, string>>;
}
const IMAGES_FILE = join(CONTENT_DIR, "images.json");
const PHOTOS: Record<string, Photo> = existsSync(IMAGES_FILE) ? (JSON.parse(readFileSync(IMAGES_FILE, "utf8")).recipes ?? {}) : {};
/** Photo for a recipe file, only if its image file really exists. */
export const photoFor = (file: string): (Photo & { path: string }) | undefined => {
  const ph = PHOTOS[file];
  if (!ph?.file) return undefined;
  const path = join(CONTENT_DIR, ph.file);
  return existsSync(path) ? { ...ph, path } : undefined;
};
