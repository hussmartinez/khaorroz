// Static site generator: turns the research Markdown in the repo root into dist/.
// English sources: recipe_*.md, provincial_*.md, history.md, README.md in the repo root.
// Translations:    i18n/<lang>/<same file name>.md, with front matter `source_hash: <hash>`
//                  (hash of the English file it was translated from; see i18n-status.ts).
// Output: English at dist/, other languages at dist/<lang>/ with the same paths.
// Illustrations:   pans.ts draws an original top-down SVG of every dish from its recipe.
import { marked } from "marked";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, renameSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { LANGS, DEFAULT_LANG, UI, HTML_LANG, type Lang } from "./i18n";
import { specFrom, panSVG, type PanSpec } from "./pans";

const ROOT = join(import.meta.dir, "..");
const FINAL = join(import.meta.dir, "dist");
// Build into a private temp dir and swap it in at the end, so concurrent builds/deploys never see a half-built site.
const OUT = join(import.meta.dir, `.dist-${process.pid}`);
const ASSETS = join(import.meta.dir, "assets");
const I18N = join(ROOT, "i18n");

export const sourceHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

// Ad slots: fixed-size reserved spaces (no layout shift when a network is plugged in). See ads.json.
type AdKind = "banner" | "inFeed" | "inArticle" | "sidebar";
const ADS: { mode: "placeholder" | "off" | "live"; head: string; slots: Record<AdKind, string> } =
  existsSync(join(import.meta.dir, "ads.json")) ? JSON.parse(readFileSync(join(import.meta.dir, "ads.json"), "utf8")) : { mode: "off", head: "", slots: {} };
const AD_SIZE: Record<AdKind, string> = { banner: "728 × 90", inFeed: "300 × 250", inArticle: "336 × 280", sidebar: "300 × 600" };
function ad(kind: AdKind, extra = "") {
  if (ADS.mode === "off") return "";
  const inner = ADS.mode === "live" ? ADS.slots[kind] ?? "" : `<span class="ad-ph">${AD_SIZE[kind]}</span>`;
  return `<aside class="ad ad-${kind}${ADS.mode === "placeholder" ? " is-placeholder" : ""}${extra}" aria-label="${esc(t("advertisement"))}"><span class="ad-label">${esc(t("advertisement"))}</span><div class="ad-slot">${inner}</div></aside>`;
}

let L: Lang = DEFAULT_LANG; // language currently being built
type Key = keyof (typeof UI)["en"];
const t = (k: Key, vars: Record<string, string | number> = {}) =>
  UI[L][k].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ""));
const nDishes = (n: number) => t(n === 1 ? "dish" : "dishes", { n });

type Kind = "recipe" | "province" | "history" | "readme";
type TStatus = "source" | "ok" | "stale" | "missing";
interface Page {
  file: string;
  kind: Kind;
  slug: string;
  url: string; // relative to the language root, e.g. recipes/paella-valenciana.html
  title: string;
  altTitle: string;
  body: string; // markdown without front matter, H1 and nav line
  zone: string;
  texture: string; // seco | meloso | caldoso | ""
  provinces: { name: string; file: string }[];
  summary: string;
  status: TStatus;
  spec?: PanSpec;
  minutes: number; // reading time, from the English source
  headings: { id: string; text: string }[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stripMd = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").trim();
const slugify = (s: string) =>
  stripMd(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Heading anchors must work for Thai too, so keep any letter; only collapse the rest.
const anchorId = (s: string) =>
  stripMd(s).normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
const provSlug = (file: string) => slugify(file.replace(/^provincial_|\.md$/g, "").replace(/_/g, "-"));

function kindOf(file: string): Kind | null {
  if (file.startsWith("recipe_")) return "recipe";
  if (file.startsWith("provincial_")) return "province";
  if (file === "history.md") return "history";
  if (file === "README.md") return "readme";
  return null;
}

function urlFor(kind: Kind, slug: string) {
  switch (kind) {
    case "recipe": return `recipes/${slug}.html`;
    case "province": return `provinces/${slug}.html`;
    case "history": return "history.html";
    case "readme": return "about.html";
  }
}

function splitFrontMatter(src: string): { meta: Record<string, string>; text: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, text: src };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, text: src.slice(m[0].length) };
}

// Parse one Markdown file. Structural metadata (texture, provinces, zone, illustration) always comes
// from the English source so filters and pictures are identical in every language.
function parse(file: string, src: string, en?: Page): Page | null {
  const kind = kindOf(file);
  if (!kind) return null;
  const lines = src.split("\n");

  const h1i = lines.findIndex((l) => /^# /.test(l));
  const h1 = h1i >= 0 ? lines[h1i].slice(2).trim() : basename(file, ".md");
  const [rawTitle, ...alt] = h1.split(" / ");
  const title = rawTitle.trim();
  let altTitle = alt.join(" / ").trim();
  // "Paella Valenciana / Paella Valenciana (Arròs a la valenciana)" → "Arròs a la valenciana"
  if (altTitle.startsWith(title)) altTitle = altTitle.slice(title.length).trim().replace(/^\((.*)\)$/, "$1");

  const navi = lines.findIndex((l) => /^>\s*⬅/.test(l));
  const provinces: Page["provinces"] = [];
  if (navi >= 0)
    for (const m of lines[navi].matchAll(/\[([^\]]+)\]\((provincial_[^)]+\.md)\)/g)) provinces.push({ name: m[1], file: m[2] });
  const drop = new Set([h1i, navi].filter((i) => i >= 0));
  const body = lines.filter((_, i) => !drop.has(i)).join("\n");

  const field = (label: string) => src.match(new RegExp(`\\*\\*${label}[^:*]*:\\*\\*\\s*(.+)`))?.[1].trim() ?? "";
  const zone = field("Primary Geographic Zone");
  const texture = (field("Liquid & Texture Profile").match(/\b(seco|meloso|caldoso)\b/i)?.[1] ?? "").toLowerCase();

  // Summary: opening of section 2 (history), else first paragraph. Works whatever the heading language.
  const sec2 = body.split(/^## /m).find((s) => /^(2\.|.*Histor)/i.test(s));
  const scope = sec2 ? sec2.split("\n").slice(1).join("\n") : body;
  const para = scope.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^[#>|*-]/.test(p)) ?? "";
  let summary = "";
  for (const sent of stripMd(para).split(/(?<=[.!?])\s+/)) {
    if (summary && (summary + " " + sent).length > 220) break;
    summary = summary ? summary + " " + sent : sent;
  }
  if (summary.length > 260) summary = summary.slice(0, 250).replace(/\s+\S*$/, "") + "…";

  const slug = slugify(basename(file, ".md").replace(/^(recipe|provincial)_/, "").replace(/_/g, "-"));
  let spec = en?.spec;
  if (!en && kind === "recipe") {
    const sec4 = body.split(/^## /m).find((s) => /^4\./.test(s)) ?? body;
    const recipeText = sec4.split("\n").filter((l) => l.startsWith("|")).join("\n") || sec4;
    spec = specFrom({ slug, title, texture, vessel: field("Traditional Cooking Vessel"), recipeText });
  }
  const minutes = en?.minutes ?? Math.max(1, Math.round(body.split(/\s+/).length / 220));
  return {
    file, kind, slug, url: urlFor(kind, slug), title, altTitle, body,
    zone: en?.zone ?? zone, texture: en?.texture ?? texture, provinces: en?.provinces ?? provinces,
    summary, status: "source", spec, minutes, headings: [],
  };
}

// ---------- Markdown rendering ----------
// Each "## " section is rendered separately and wrapped, so section 4 (the recipe itself) can get
// cooking tools (ingredient checklist, timers) and every section can animate in on scroll.
function render(page: Page, toLang: string, byFile: Map<string, Page>): string {
  const headings: Page["headings"] = [];
  const used = new Set<string>();
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth, text }) {
    const inner = this.parser.parseInline(tokens);
    const clean = stripMd(text).replace(/^\d+\.\s*/, "").replace(/\s*\(Crucial\)$/i, "");
    let id = anchorId(clean) || "section";
    while (used.has(id)) id += "-x";
    used.add(id);
    if (depth === 2) headings.push({ id, text: clean });
    const num = depth === 2 ? text.match(/^(\d+)\./)?.[1] : undefined;
    const shown = depth === 2 ? `${num ? `<span class="h-num">${num.padStart(2, "0")}</span>` : ""}${esc(clean)}` : inner;
    return `<h${depth} id="${id}"><a class="anchor" href="#${id}">${shown}</a></h${depth}>\n`;
  };
  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const tt = title ? ` title="${esc(title)}"` : "";
    const local = href.match(/^([\w.-]+\.md)(#.*)?$/);
    if (local) {
      const target = byFile.get(local[1]);
      if (target) return `<a href="${toLang}${target.url}${local[2] ?? ""}"${tt}>${text}</a>`;
      return `<span class="missing-link" title="${esc(t("missingLink"))}">${text}</span>`;
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
    const inner = marked.parse(chunk, { renderer, gfm: true, async: false }) as string;
    if (!inner.trim()) return "";
    const num = chunk.match(/^## (\d+)\./)?.[1];
    const cls = num === "4" && page.kind === "recipe" ? " sec-recipe" : !chunk.startsWith("## ") ? " sec-intro" : "";
    // Never inside the recipe itself: after the history (2) and after the recipe (4), max two per page.
    const adHere = adsPlaced < 2 && i < chunks.length - 1 && (page.kind === "recipe" ? num === "2" || num === "4" : i === 2 || i === 6);
    if (adHere) adsPlaced++;
    return `<section class="sec${cls}"${num ? ` data-sec="${num}"` : ""} data-reveal>${inner}</section>${adHere ? ad("inArticle") : ""}`;
  }).join("\n");
  page.headings = headings;
  return html;
}

// ---------- Layout ----------
interface Ctx { toRoot: string; toLang: string; path: string } // path = page path relative to a language root

const langRoot = (lang: Lang) => (lang === DEFAULT_LANG ? "" : `${lang}/`);

function layout(ctx: Ctx, opts: { title: string; active: string; main: string; description?: string; bodyClass?: string }) {
  const { toRoot, toLang, path } = ctx;
  const { title, active, main, description, bodyClass } = opts;
  const nav = ([
    ["index.html", t("navRecipes"), "recipes"],
    ["history.html", t("navHistory"), "history"],
    ["provinces.html", t("navRegions"), "provinces"],
    ["about.html", t("navAbout"), "about"],
  ] as const)
    .map(([h, l, k]) => `<a href="${toLang}${h}"${k === active ? ' aria-current="page"' : ""}>${esc(l)}</a>`)
    .join("");
  const switcher = LANGS.map((lg) =>
    `<a href="${toRoot}${langRoot(lg)}${path}" hreflang="${HTML_LANG[lg]}" lang="${HTML_LANG[lg]}" data-lang="${lg}"${lg === L ? ' aria-current="true"' : ""}>${esc(UI[lg].langName)}</a>`
  ).join("");
  const alternates = LANGS.map((lg) =>
    `<link rel="alternate" hreflang="${HTML_LANG[lg]}" href="${toRoot}${langRoot(lg)}${path}">`
  ).join("\n");
  const site = t("siteName");
  return `<!doctype html>
<html lang="${HTML_LANG[L]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#fbf6ec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16120e" media="(prefers-color-scheme: dark)">
<title>${esc(title)}${title === site ? "" : ` · ${esc(site)}`}</title>
<meta name="description" content="${esc(description ?? t("metaDescription"))}">
${alternates}
<script>document.documentElement.classList.add("js")</script>
<link rel="preload" href="${toRoot}fonts/fraunces-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${toRoot}fonts.css">
<link rel="stylesheet" href="${toRoot}style.css">
${ADS.mode === "live" ? ADS.head : ""}
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥘</text></svg>">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
<div class="progress" aria-hidden="true"></div>
<a class="skip" href="#main">↓</a>
<header class="site-header">
  <a class="brand" href="${toLang}index.html"><span class="brand-pan" aria-hidden="true"></span><span>Arròs</span></a>
  <nav class="main-nav">${nav}</nav>
  <details class="lang">
    <summary aria-label="${esc(t("language"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><span>${esc(UI[L].langName)}</span></summary>
    <div class="lang-menu">${switcher}</div>
  </details>
</header>
<div id="main">
${main}
</div>
<footer class="site-footer">
  <div class="footer-pan" aria-hidden="true"></div>
  <p class="footer-big">${esc(t("footer1"))}</p>
  <p class="small">${esc(t("footer2"))}</p>
  <p class="small"><a href="#top" data-top>${esc(t("backToTop"))} ↑</a></p>
</footer>
<div class="timers" aria-live="polite" data-done="${esc(t("timerDone"))}"></div>
<script src="${toRoot}site.js" defer></script>
</body>
</html>`;
}

const TEX_KEY = { seco: "chipSeco", meloso: "chipMeloso", caldoso: "chipCaldoso" } as const;
const chip = (texture: string) => {
  const key = TEX_KEY[texture as keyof typeof TEX_KEY];
  return key ? `<span class="chip chip-${texture}"><i></i>${esc(t(key))}</span>` : "";
};
const shortTex = (k: Key) => t(k).split(" · ")[0];
const provName = (n: string) => n.replace(/^Prov[ií]ncia\s+(de\s+|d')?/i, "");
const VESSEL: Record<string, string> = { paella: "Paella", cassola: "Cassola", caldero: "Caldero", olla: "Olla" };
type RegionName = (file: string, fallback: string) => string;
const vtName = (prefix: string, slug: string) => `${prefix}-${slug}`.slice(0, 120);

function pan(p: Page, opts: { steam?: boolean; cls?: string; label?: boolean } = {}) {
  if (!p.spec) return "";
  return panSVG(p.spec, p.slug, { steam: opts.steam, cls: opts.cls, label: opts.label ? p.title : undefined });
}

function card(p: Page, toLang: string, regionName: RegionName, i = 0) {
  const provs = p.provinces.map((x) => regionName(x.file, x.name)).join(" · ");
  return `<a class="card base-${p.spec?.base ?? "none"}" href="${toLang}${p.url}" style="--i:${i % 12};view-transition-name:${vtName("card", p.slug)}" data-reveal data-texture="${p.texture}" data-provinces="${esc(p.provinces.map((x) => x.file).join(" "))}" data-search="${esc((p.title + " " + p.altTitle + " " + p.zone + " " + p.summary).toLowerCase())}">
  <div class="card-visual" style="view-transition-name:${vtName("pan", p.slug)}">${pan(p)}</div>
  <div class="card-body">
    <div class="card-meta">${chip(p.texture)}${p.spec ? `<span class="vessel">${VESSEL[p.spec.vessel]}</span>` : ""}</div>
    <h3>${esc(p.title)}</h3>
    ${p.altTitle ? `<p class="alt">${esc(p.altTitle)}</p>` : ""}
    <p class="summary">${esc(p.summary)}</p>
    ${provs ? `<p class="card-foot"><span class="pin" aria-hidden="true"></span>${esc(provs)}<span class="arrow" aria-hidden="true">→</span></p>` : ""}
  </div>
</a>`;
}

function notice(status: TStatus) {
  if (status === "missing") return `<p class="i18n-note">${esc(t("notTranslated"))}</p>`;
  if (status === "stale") return `<p class="i18n-note">${esc(t("staleTranslation"))}</p>`;
  return "";
}

function toc(p: Page) {
  if (p.headings.length < 2) return "";
  return `<aside class="toc"><nav aria-label="${esc(t("onThisPage"))}"><p class="toc-title">${esc(t("onThisPage"))}</p><ol>${p.headings
    .map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join("")}</ol>${ad("sidebar")}</nav></aside>`;
}

function recipeArticle(p: Page, html: string, ctx: Ctx, regionName: RegionName) {
  const provLinks = p.provinces
    .map((x) => `<a class="tag" href="${ctx.toLang}provinces/${provSlug(x.file)}.html"><span class="pin" aria-hidden="true"></span>${esc(regionName(x.file, x.name))}</a>`)
    .join("");
  const lang = p.status === "missing" ? ` lang="${HTML_LANG[DEFAULT_LANG]}"` : "";
  return `<main class="recipe base-${p.spec?.base ?? "none"}">
  <header class="recipe-hero">
    <div class="rh-text">
      <p class="kicker">${esc(t("kickerRecipe"))} · ${esc(t("readTime", { n: p.minutes }))}</p>
      <h1 class="rh-title">${esc(p.title)}</h1>
      ${p.altTitle ? `<p class="alt-title">${esc(p.altTitle)}</p>` : ""}
      <div class="tags">${chip(p.texture)}${p.spec ? `<span class="tag"><span class="tag-k">${esc(t("vessel"))}</span> ${VESSEL[p.spec.vessel]}</span>` : ""}${provLinks}</div>
      ${notice(p.status)}
      <div class="rh-actions">
        <button class="btn btn-primary" type="button" data-cook aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16v2a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7zM2 11h2M20 11h2M9 4c-1 1 1 2 0 4M13 3c-1 1 1 3 0 5"/></svg><span>${esc(t("cookingMode"))}</span></button>
        <button class="btn" type="button" onclick="window.print()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z"/></svg><span>${esc(t("print"))}</span></button>
      </div>
      <p class="cook-hint" hidden>${esc(t("cookingModeOn"))} · ${esc(t("tapToCheck"))}</p>
    </div>
    <div class="rh-visual" style="view-transition-name:${vtName("pan", p.slug)}">${pan(p, { cls: "hero-pan", label: true })}</div>
  </header>
  <div class="page with-toc">
    ${toc(p)}
    <article class="prose" data-timer-label="${esc(t("timerStart", { n: "{n}" }))}"${lang}>${html}</article>
  </div>
</main>`;
}

function article(p: Page, html: string, ctx: Ctx, kicker: string, regionName: RegionName, extraHead = "") {
  const lang = p.status === "missing" ? ` lang="${HTML_LANG[DEFAULT_LANG]}"` : "";
  const tc = toc(p);
  return `<main>
  <header class="page-hero">
    <div class="wrap">
      <p class="kicker">${esc(kicker)}</p>
      <h1>${esc(p.kind === "province" ? regionName(p.file, p.title) : p.title)}</h1>
      ${p.altTitle ? `<p class="alt-title">${esc(p.altTitle)}</p>` : ""}
      ${notice(p.status)}
      ${extraHead}
    </div>
  </header>
  <div class="page${tc ? " with-toc" : ""}">
    ${tc}
    <article class="prose"${lang}>${html}</article>
  </div>
</main>`;
}

// ---------- Content loading ----------
function loadEnglish(): Page[] {
  return readdirSync(ROOT).filter((f) => f.endsWith(".md")).sort()
    .map((f) => parse(f, readFileSync(join(ROOT, f), "utf8"))).filter(Boolean) as Page[];
}

function loadLang(lang: Lang, en: Page[]): Page[] {
  if (lang === DEFAULT_LANG) return en.map((p) => ({ ...p, headings: [] }));
  return en.map((ep) => {
    const tf = join(I18N, lang, ep.file);
    if (!existsSync(tf)) return { ...ep, status: "missing" as TStatus, headings: [] };
    const { meta, text } = splitFrontMatter(readFileSync(tf, "utf8"));
    const p = parse(ep.file, text, ep)!;
    const current = sourceHash(readFileSync(join(ROOT, ep.file), "utf8"));
    p.status = meta.source_hash === current ? "ok" : "stale";
    return p;
  });
}

// ---------- Build one language ----------
function buildLang(lang: Lang, en: Page[]) {
  L = lang;
  const out = join(OUT, langRoot(lang));
  mkdirSync(join(out, "recipes"), { recursive: true });
  mkdirSync(join(out, "provinces"), { recursive: true });
  const toRoot1 = lang === DEFAULT_LANG ? "" : "../"; // from a top-level page to dist root
  const ctxTop = (path: string): Ctx => ({ toRoot: toRoot1, toLang: "", path });
  const ctxSub = (path: string): Ctx => ({ toRoot: toRoot1 + "../", toLang: "../", path });

  const pages = loadLang(lang, en);
  const byFile = new Map(pages.map((p) => [p.file, p]));
  const recipes = pages.filter((p) => p.kind === "recipe").sort((a, b) => a.title.localeCompare(b.title, "es"));
  const provinces = pages.filter((p) => p.kind === "province");

  // Region display name: translated province page title if present, else the nav-line label.
  const regionName: RegionName = (file, fallback) => {
    const p = byFile.get(file);
    return provName(p && lang !== DEFAULT_LANG && p.status !== "missing" ? p.title : fallback);
  };
  const provRefs = new Map<string, string>();
  for (const r of recipes) for (const x of r.provinces) provRefs.set(x.file, x.name);
  const regionList: [string, string][] = [
    ...provRefs.entries(),
    ...provinces.filter((p) => !provRefs.has(p.file)).map((p) => [p.file, p.title] as [string, string]),
  ];
  const recipesIn = (file: string) => recipes.filter((r) => r.provinces.some((x) => x.file === file));
  const withFeedAds = (cards: string[]) => cards.map((c, i) => (i > 0 && i % 9 === 0 ? ad("inFeed") : "") + c).join("");
  const grid = (list: Page[], toLang: string) =>
    `<div class="grid">${withFeedAds(list.map((r, i) => card(r, toLang, regionName, i)))}</div>`;

  for (const p of pages) {
    const sub = p.kind === "recipe" || p.kind === "province";
    const ctx = sub ? ctxSub(p.url) : ctxTop(p.url);
    const html = render(p, ctx.toLang, byFile);
    let main: string;
    if (p.kind === "recipe") main = recipeArticle(p, html, ctx, regionName);
    else if (p.kind === "province") {
      const list = recipesIn(p.file);
      main = article(p, html, ctx, t("kickerRegion"), regionName,
        list.length ? `<div class="mini-pans" aria-hidden="true">${list.slice(0, 5).map((r) => pan(r, { steam: false })).join("")}</div>` : "") +
        (list.length ? `<section class="wrap dishes"><h2 class="section-title" data-reveal>${esc(t("dishesFrom", { name: regionName(p.file, p.title) }))}</h2>${grid(list, ctx.toLang)}</section>` : "");
    } else main = article(p, html, ctx, p.kind === "history" ? t("kickerHistory") : t("kickerAbout"), regionName);
    const active = { recipe: "recipes", province: "provinces", history: "history", readme: "about" }[p.kind];
    writeFileSync(join(out, p.url), layout(ctx, { title: p.title, active, main, description: p.summary || undefined, bodyClass: p.kind === "recipe" ? "is-recipe" : undefined }));
  }

  // Placeholders so links never 404 while research is in progress
  const placeholder = (ctx: Ctx, title: string, active: string, extra = "") =>
    writeFileSync(join(out, ctx.path), layout(ctx, {
      title, active,
      main: `<main><header class="page-hero"><div class="wrap"><h1>${esc(title)}</h1><p class="note">${esc(t("stillResearched"))}</p></div></header>${extra}</main>`,
    }));
  for (const [file, name] of provRefs) {
    if (byFile.has(file)) continue;
    placeholder(ctxSub(`provinces/${provSlug(file)}.html`), regionName(file, name), "provinces",
      `<section class="wrap dishes">${grid(recipesIn(file), "../")}</section>`);
  }
  if (!byFile.has("history.md")) writeHistoryFallback(out, ctxTop("history.html"), recipes);
  if (!byFile.has("README.md")) placeholder(ctxTop("about.html"), t("aboutTitle"), "about");

  // Regions index
  const regionCards = regionList
    .map(([file, name], i) => {
      const list = recipesIn(file);
      return `<a class="region" href="provinces/${provSlug(file)}.html" style="--i:${i % 12}" data-reveal>
  <div class="region-pans" aria-hidden="true">${list.slice(0, 3).map((r) => pan(r, { steam: false })).join("")}</div>
  <div class="region-text"><h3>${esc(regionName(file, name))}</h3><p>${esc(nDishes(list.length))}</p></div><span class="arrow" aria-hidden="true">→</span></a>`;
    })
    .join("");
  writeFileSync(join(out, "provinces.html"), layout(ctxTop("provinces.html"), {
    title: t("navRegions"), active: "provinces",
    main: `<main><header class="page-hero"><div class="wrap"><p class="kicker">${esc(t("navRegions"))}</p><h1>${esc(t("regionsTitle"))}</h1><p class="lede">${esc(t("regionsLede"))}</p></div></header><section class="wrap"><div class="regions">${regionCards}</div></section></main>`,
  }));

  // Home
  const provFilters = regionList.filter(([f]) => provRefs.has(f))
    .map(([file, name]) => `<button type="button" data-filter-province="${esc(file)}">${esc(regionName(file, name))}</button>`)
    .join("");
  const counts: Record<string, number> = { seco: 0, meloso: 0, caldoso: 0 };
  for (const r of recipes) if (r.texture in counts) counts[r.texture]++;
  const heroDish = recipes.find((r) => r.slug === "paella-valenciana") ?? recipes[0];
  const sample = (tex: string) => recipes.find((r) => r.texture === tex && r.spec && !["negro", "costra", "horno"].includes(r.spec.base));
  const words = t("heroTitle").split("<br>").map((line) =>
    `<span class="line">${line.split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) ? w : `<span class="word" style="--w:${i}">${esc(w)}</span>`)).join("")}</span>`
  ).join("");
  const marquee = recipes.map((r) => `<span>${esc(r.title)}</span>`).join(`<i aria-hidden="true">✺</i>`);
  const texTile = (tex: "seco" | "meloso" | "caldoso", key: Key, desc: Key) => {
    const s = sample(tex);
    return `<a class="tex-tile tex-${tex}" href="#recipes" data-set-texture="${tex}" data-reveal style="--i:${["seco", "meloso", "caldoso"].indexOf(tex)}">
  <div class="tex-pan">${s ? pan(s, { steam: true }) : ""}</div>
  <div><strong>${esc(shortTex(key))}</strong><span>${esc(t(desc))}</span></div><em>${counts[tex]}</em></a>`;
  };
  const home = `<main class="home">
  <section class="hero">
    <div class="hero-bg" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="hero-inner">
      <div class="hero-text">
        <p class="kicker hero-kicker">${esc(t("heroKicker"))}</p>
        <h1 class="hero-title">${words}</h1>
        <p class="lede hero-lede">${esc(t("heroLede"))}</p>
        <a class="btn btn-primary hero-cta" href="#recipes">${esc(t("exploreDishes"))} <span aria-hidden="true">↓</span></a>
      </div>
      <div class="hero-visual">${heroDish ? `<div class="hero-pan-wrap" style="view-transition-name:${vtName("pan", heroDish.slug)}">${pan(heroDish, { cls: "hero-pan", label: true })}</div>` : ""}
        <div class="hero-stat"><strong>${recipes.length}</strong><span>${esc(t("navRecipes"))}</span></div>
        <div class="hero-stat hero-stat-2"><strong>${regionList.length}</strong><span>${esc(t("navRegions"))}</span></div>
      </div>
    </div>
  </section>
  <div class="marquee" aria-hidden="true"><div class="marquee-track">${marquee}<i>✺</i>${marquee}<i>✺</i></div></div>
  <section class="wrap textures-sec">
    <p class="kicker" data-reveal>${esc(t("texturesKicker"))}</p>
    <h2 class="section-title big" data-reveal>${esc(t("texturesTitle"))}</h2>
    <div class="textures">${texTile("seco", "chipSeco", "secoDesc")}${texTile("meloso", "chipMeloso", "melosoDesc")}${texTile("caldoso", "chipCaldoso", "caldosoDesc")}</div>
  </section>
  <div class="wrap">${ad("banner")}</div>
  <section class="wrap" id="recipes" data-one="${esc(t("dish"))}" data-many="${esc(t("dishes"))}">
    <div class="toolbar" data-reveal>
      <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="q" placeholder="${esc(t("searchPlaceholder"))}" aria-label="${esc(t("searchLabel"))}"></label>
      <div class="filters seg" role="group" aria-label="${esc(t("texture"))}">
        <button type="button" data-filter-texture="" aria-pressed="true">${esc(t("all"))}</button>
        <button type="button" data-filter-texture="seco"><i class="dot dot-seco"></i>${esc(shortTex("chipSeco"))}</button>
        <button type="button" data-filter-texture="meloso"><i class="dot dot-meloso"></i>${esc(shortTex("chipMeloso"))}</button>
        <button type="button" data-filter-texture="caldoso"><i class="dot dot-caldoso"></i>${esc(shortTex("chipCaldoso"))}</button>
      </div>
      <div class="filters regions-filter" role="group" aria-label="${esc(t("region"))}">
        <button type="button" data-filter-province="" aria-pressed="true">${esc(t("allRegions"))}</button>${provFilters}
      </div>
    </div>
    <p class="count" id="count">${esc(nDishes(recipes.length))}</p>
    <div class="grid" id="grid">${withFeedAds(recipes.map((r, i) => card(r, "", regionName, i)))}</div>
    <p class="empty" id="empty" hidden>${esc(t("noMatch"))}</p>
  </section>
</main>`;
  writeFileSync(join(out, "index.html"), layout(ctxTop("index.html"), { title: t("siteName"), active: "recipes", main: home, bodyClass: "is-home" }));

  const st: Record<TStatus, number> = { ok: 0, stale: 0, missing: 0, source: 0 };
  for (const p of pages) st[p.status]++;
  console.log(lang === DEFAULT_LANG
    ? `[${lang}] ${recipes.length} recipes, ${regionList.length} regions, ${pages.length} pages`
    : `[${lang}] translated ${st.ok}/${pages.length}${st.stale ? `, ${st.stale} stale` : ""}${st.missing ? `, ${st.missing} missing (English shown)` : ""}`);
}

// Until history.md exists, assemble the history page from each recipe's history section.
function writeHistoryFallback(out: string, ctx: Ctx, recipes: Page[]) {
  const parts = recipes.map((r) => {
    const sec = r.body.split(/^## /m).find((s) => /^(2\.|.*Histor)/i.test(s));
    if (!sec) return "";
    const text = sec.split("\n").slice(1).join("\n").trim()
      .replace(/\]\((recipe_[^)]+)\.md\)/g, (_, f) => `](recipes/${slugify(f.replace(/^recipe_/, "").replace(/_/g, "-"))}.html)`);
    const html = marked.parse(text, { async: false }) as string;
    const lang = r.status === "missing" ? ` lang="${HTML_LANG[DEFAULT_LANG]}"` : "";
    return `<section class="history-entry" data-reveal${lang}><a class="he-pan" href="${r.url}" aria-hidden="true" tabindex="-1">${pan(r, { steam: false })}</a><div><h2 id="${r.slug}"><a href="${r.url}">${esc(r.title)}</a></h2>${r.altTitle ? `<p class="alt">${esc(r.altTitle)}</p>` : ""}${html}</div></section>`;
  }).join("");
  writeFileSync(join(out, "history.html"), layout(ctx, {
    title: t("navHistory"), active: "history",
    main: `<main><header class="page-hero"><div class="wrap"><p class="kicker">${esc(t("kickerHistory"))}</p><h1>${esc(t("historyFallbackTitle"))}</h1><p class="lede">${esc(t("historyFallbackLede"))}</p></div></header><div class="page"><article class="prose wide">${parts}</article></div></main>`,
  }));
}

// ---------- Main ----------
if (import.meta.main) {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(ASSETS, OUT, { recursive: true });
  const en = loadEnglish();
  try {
    for (const lang of LANGS) buildLang(lang, en);
  } catch (e) {
    rmSync(OUT, { recursive: true, force: true });
    throw e;
  }
  const old = `${FINAL}.old-${process.pid}`;
  if (existsSync(FINAL)) renameSync(FINAL, old);
  renameSync(OUT, FINAL);
  rmSync(old, { recursive: true, force: true });
  console.log(`→ ${FINAL}`);
}
