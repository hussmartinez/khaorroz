// Khaorroz UI/UX audit: real-browser screenshots, metrics, accessibility and interaction journeys.
// Usage: bun run audit.ts [baseUrl] [outDir]
import { chromium, type Page, type BrowserContext } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "https://khaorroz.forfreedom.app";
const OUT = process.argv[3] ?? "/tmp/ux-audit";
mkdirSync(join(OUT, "shots"), { recursive: true });

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
} as const;

const PAGES: [string, string][] = [
  ["portal", "/"], ["spain", "/spain"], ["sham", "/sham"], ["thai", "/thai"],
  ["history-index", "/history"], ["history-spain", "/spain/history"], ["history-sham", "/sham/history"],
  ["regions", "/provinces"], ["region-valencia", "/provinces/valencia"],
  ["recipe-paella", "/recipes/paella-valenciana"], ["recipe-maqluba", "/recipes/maqluba"], ["recipe-khaomankai", "/recipes/khao-man-kai"],
  ["about", "/about"], ["dishes", "/dishes"], ["credits", "/credits"], ["saved", "/saved"], ["ar-sham", "/ar/sham"], ["ar-recipe-maqluba", "/ar/recipes/maqluba"], ["es-spain", "/es/spain"], ["notfound", "/this-does-not-exist"],
];

type Row = Record<string, unknown>;
const results: Row[] = [];
const journeys: Row[] = [];

async function vitals(page: Page) {
  return page.evaluate(() => new Promise<{ lcp: number; cls: number }>((resolve) => {
    let lcp = 0, cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = Math.max(lcp, (e as any).startTime); }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    setTimeout(() => resolve({ lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000 }), 2500);
  }));
}

async function auditPage(ctx: BrowserContext, vpName: string, name: string, path: string, scheme: "light" | "dark") {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [], failed: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/this-does-not-exist")) failed.push(`${r.status()} ${r.url()}`); });
  let bytes = 0;
  page.on("response", async (r) => { const len = Number(r.headers()["content-length"] ?? 0); bytes += len; });
  const t0 = Date.now();
  await page.goto(BASE + path, { waitUntil: "load", timeout: 60000 });
  const loadMs = Date.now() - t0;
  const v = await vitals(page);
  // scroll through to trigger reveals/lazy images, then back to top
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(600);
  const dom = await page.evaluate((isMobile) => {
    const vw = window.innerWidth;
    const overflow = document.documentElement.scrollWidth - vw;
    const wideEls = isMobile ? [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 2 && r.width > 0 && getComputedStyle(e).position !== "fixed"; }).slice(0, 5).map((e) => (e as HTMLElement).className || e.tagName) : [];
    const targets = [...document.querySelectorAll("a, button, select, input, summary")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const small = isMobile ? targets.filter((e) => { const r = e.getBoundingClientRect(); return r.height < 40 || r.width < 40; }) : [];
    const header = document.querySelector(".site-header")?.getBoundingClientRect();
    return {
      title: document.title, h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim().slice(0, 60)),
      dir: document.documentElement.dir, lang: document.documentElement.lang,
      overflowPx: overflow, wideEls, nodes: document.querySelectorAll("*").length,
      imgsNoAlt: [...document.querySelectorAll("img:not([alt])")].length,
      smallTargets: small.length, smallSample: small.slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${(e as HTMLElement).className?.toString().split(" ")[0] ?? ""}:${(e.textContent ?? "").trim().slice(0, 18)}`),
      headerHeightPct: header ? Math.round((header.height / window.innerHeight) * 100) : 0,
      docHeightScreens: Math.round((document.body.scrollHeight / window.innerHeight) * 10) / 10,
      cards: document.querySelectorAll(".card").length,
    };
  }, vpName === "mobile");
  let axe: { id: string; impact: string; n: number; help: string }[] = [];
  if (scheme === "light") {
    try {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      axe = r.violations.map((x) => ({ id: x.id, impact: x.impact ?? "", n: x.nodes.length, help: x.help }));
    } catch (e) { axe = [{ id: "axe-error", impact: "", n: 0, help: String(e).slice(0, 120) }]; }
  }
  const shot = `${vpName}-${scheme}-${name}.png`;
  await page.screenshot({ path: join(OUT, "shots", shot), fullPage: true });
  await page.screenshot({ path: join(OUT, "shots", `${vpName}-${scheme}-${name}-fold.png`) });
  results.push({ vp: vpName, scheme, name, path, loadMs, ...v, kb: Math.round(bytes / 1024), consoleErrors, failed: failed.slice(0, 8), ...dom, axe, shot });
  await page.close();
}

async function journey(name: string, ctx: BrowserContext, fn: (p: Page) => Promise<Row>) {
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  try { journeys.push({ name, ok: true, ...(await fn(page)), errors: errs }); }
  catch (e) { journeys.push({ name, ok: false, error: String(e).slice(0, 300), errors: errs }); await page.screenshot({ path: join(OUT, "shots", `journey-fail-${name}.png`) }).catch(() => {}); }
  await page.close();
}

const browser = await chromium.launch();
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const scheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ ...vp, colorScheme: scheme, reducedMotion: "reduce" });
    const list = scheme === "dark" ? PAGES.filter(([n]) => ["portal", "sham", "recipe-paella", "thai"].includes(n)) : PAGES;
    for (const [name, path] of list) {
      try { await auditPage(ctx, vpName, name, path, scheme); } catch (e) { results.push({ vp: vpName, scheme, name, path, fatal: String(e).slice(0, 200) }); }
      process.stdout.write(".");
    }
    await ctx.close();
  }
}

// ---------- interaction journeys (with motion on, as users have it) ----------
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ ...vp, permissions: ["clipboard-read", "clipboard-write"] });
  await journey(`${vpName}: portal → Spain door → switcher`, ctx, async (p) => {
    await p.goto(BASE + "/");
    await p.locator(".door-spain").first().click();
    await p.waitForURL(/\/spain$/);
    const active = await p.locator('.sec-pill[aria-current="page"]').innerText();
    await p.locator('.sec-pill[data-theme="sham"]').click();
    await p.waitForURL(/\/sham$/);
    const theme = await p.evaluate(() => document.body.dataset.theme);
    return { activeOnSpain: active.trim(), themeAfterSwitch: theme };
  });
  await journey(`${vpName}: section filters + search`, ctx, async (p) => {
    await p.goto(BASE + "/spain");
    const count0 = await p.locator("#count").innerText();
    const visible = async () => p.locator(".card:not([hidden])").count();
    const all = await visible();
    // desktop chips / mobile selects
    const chip = p.locator('[data-filter-texture="caldoso"]');
    if (await chip.isVisible()) await chip.click(); else await p.selectOption('[data-select="texture"]', "caldoso");
    await p.waitForTimeout(800);
    const afterTexture = await visible();
    const regionChip = p.locator('[data-filter-province="provincial_valencia.md"]');
    if (await regionChip.isVisible()) await regionChip.click(); else await p.selectOption('[data-select="province"]', "provincial_valencia.md");
    await p.waitForTimeout(800);
    const afterRegion = await visible();
    await p.goto(BASE + "/spain");
    await p.fill("#q", "garrofó");
    await p.waitForTimeout(2500);
    const searchVisible = await visible();
    const ftHits = await p.locator(".ft-hit").count();
    await p.goto(BASE + "/spain?q=allioli");
    await p.waitForTimeout(2500);
    const qParam = await visible();
    return { count0, all, afterTexture, afterRegion, search_garrofo: searchVisible, fullTextExcerpts: ftHits, q_allioli: qParam };
  });
  await journey(`${vpName}: recipe tabs + tools`, ctx, async (p) => {
    await p.goto(BASE + "/recipes/maqluba");
    const recipeTop = await p.evaluate(() => Math.round((document.querySelector(".sec-recipe")?.getBoundingClientRect().top ?? 0) + scrollY));
    const tabs = await p.locator(".rtabs [role=tab]").count();
    const selected = await p.locator('.rtabs [aria-selected="true"]').innerText();
    await p.locator('.rtabs [data-tab="history"]').click();
    const historyVisible = await p.locator('[data-panel="history"]').isVisible();
    const recipeHidden = await p.locator('[data-panel="recipe"]').isHidden();
    await p.locator('[data-tab-link="recipe"]').first().click();
    await p.waitForTimeout(600);
    await p.locator("[data-cook]").click();
    await p.waitForTimeout(600);
    const cooking = await p.evaluate(() => document.body.classList.contains("cooking"));
    const row = p.locator(".sec-recipe tbody tr").first();
    await row.scrollIntoViewIfNeeded(); await row.click();
    const checked = await row.getAttribute("aria-checked");
    const timers = await p.locator(".timer-btn").count();
    if (timers) { await p.locator(".timer-btn").first().scrollIntoViewIfNeeded(); await p.locator(".timer-btn").first().click(); }
    await p.waitForTimeout(1000);
    const timerShown = await p.locator(".timer").count();
    await p.goto(BASE + "/recipes/maqluba#sources");
    const deepLink = await p.locator('[data-panel="sources"]').isVisible();
    await p.screenshot({ path: join(OUT, "shots", `${vpName}-journey-recipe-tools.png`) });
    return { recipeSectionY: recipeTop, recipeScreens: Math.round((recipeTop / p.viewportSize()!.height) * 10) / 10, tabs, selected: selected.trim(), historyVisible, recipeHidden, cooking, ingredientChecked: checked, timerButtons: timers, timerShown, deepLinkSources: deepLink };
  });
  await journey(`${vpName}: site search dialog`, ctx, async (p) => {
    await p.goto(BASE + "/");
    await p.locator(".search-btn").click();
    await p.locator(".search-dialog input").fill("maqluba");
    await p.waitForTimeout(2500);
    const results = await p.locator(".sd-results li a").count();
    const first = results ? await p.locator(".sd-results li a strong").first().innerText() : "";
    await p.screenshot({ path: join(OUT, "shots", `${vpName}-journey-search.png`) });
    return { results, first };
  });
  await journey(`${vpName}: group / sort / view`, ctx, async (p) => {
    await p.goto(BASE + "/spain");
    await p.selectOption("[data-group]", "region");
    await p.waitForTimeout(600);
    const heads = await p.locator(".grid-group-head").count();
    await p.locator('button[data-view="list"]').click();
    const view = await p.evaluate(() => document.querySelector("#recipes")?.getAttribute("data-view"));
    const cardH = await p.locator(".card").first().evaluate((e) => Math.round(e.getBoundingClientRect().height));
    await p.selectOption("[data-group]", "");
    return { groupHeads: heads, view, listCardHeight: cardH };
  });
  await journey(`${vpName}: A–Z filter`, ctx, async (p) => {
    await p.goto(BASE + "/dishes");
    const all = await p.locator(".az-group li:not([hidden])").count();
    await p.locator('[data-az-area="thai"]').click();
    const thai = await p.locator(".az-group li:not([hidden])").count();
    return { all, thai };
  });
  await journey(`${vpName}: language switch → Arabic RTL keeps path`, ctx, async (p) => {
    await p.goto(BASE + "/recipes/maqluba");
    if (await p.locator("[data-open-menu]").isVisible()) {
      await p.locator("[data-open-menu]").click();
      await p.locator('.menu-langs a[data-lang="ar"]').click();
    } else {
      await p.locator("details.lang summary").click();
      await p.locator('.lang-menu a[data-lang="ar"]').click();
    }
    await p.waitForURL(/\/ar\//);
    const dir = await p.evaluate(() => document.documentElement.dir);
    return { url: p.url(), dir, untranslatedNotice: await p.locator(".i18n-note").count() };
  });
  await journey(`${vpName}: P3 scaler / save / share / recent / maps`, ctx, async (p) => {
    await p.goto(BASE + "/recipes/paella-valenciana");
    const qty0 = (await p.locator(".sec-recipe tbody tr td:nth-child(2)").first().innerText()).trim();
    await p.locator('.scaler [data-scale="1"]').click(); await p.locator('.scaler [data-scale="1"]').click();
    const qty6 = (await p.locator(".sec-recipe tbody tr td:nth-child(2)").first().innerText()).trim();
    const noteShown = await p.locator(".scaled-note").isVisible();
    await p.locator('.scaler [data-scale="-1"]').click(); await p.locator('.scaler [data-scale="-1"]').click();
    const qtyBack = (await p.locator(".sec-recipe tbody tr td:nth-child(2)").first().innerText()).trim();
    await p.locator("[data-save]").click();
    const savedPressed = await p.locator("[data-save]").getAttribute("aria-pressed");
    await p.locator("[data-share]").click();
    await p.waitForTimeout(500);
    const toastOrShare = (await p.locator(".toast.show").count()) > 0;
    const locatorOn = await p.locator(".glance-map .map-region.is-on").count();
    await p.goto(BASE + "/saved");
    await p.waitForTimeout(1500);
    const savedCards = await p.locator("[data-saved-list] .card").count();
    const recentCards = await p.locator("[data-recent-full] .card").count();
    await p.goto(BASE + "/");
    await p.waitForTimeout(1500);
    const strip = await p.locator("[data-recent-strip]:not([hidden]) .recent-chip").count();
    await p.goto(BASE + "/provinces");
    const mapRegions = await p.locator(".map-area .map-region").count();
    await p.goto(BASE + "/provinces/isan");
    const regionLocator = await p.locator(".region-locator .map-region.is-on").count();
    await p.screenshot({ path: join(OUT, "shots", `${vpName}-journey-p3.png`) });
    return { qty0, qty6, noteShown, qtyBack, savedPressed, toastOrShare, locatorOn, savedCards, recentCards, portalRecentChips: strip, mapRegions, regionLocator };
  });
  await journey(`${vpName}: 404`, ctx, async (p) => {
    const r = await p.goto(BASE + "/nope-xyz");
    return { status: r?.status(), h1: await p.locator("h1").first().innerText() };
  });
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), results, journeys }, null, 2));
console.log(`\n${results.length} page audits, ${journeys.length} journeys → ${OUT}`);
