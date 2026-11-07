// Social / structured-data images rendered at build time with resvg (no browser needed).
// 16:9 card (1200×675) per recipe and language + 1:1 illustration (800×800) per recipe.
// Fonts are TrueType copies in apps/web/og-fonts (resvg can't read woff2); never served.
import { Resvg } from "@resvg/resvg-js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { panSVG } from "@arros/pans";
import type { Page } from "@arros/content";
import { isRtl, type Lang } from "./site";

const FONT_DIR = join(process.cwd(), "og-fonts");
const fontFiles = readdirSync(FONT_DIR).filter((f) => f.endsWith(".ttf")).map((f) => join(FONT_DIR, f));

const THEMES = {
  spain: { bg: "#fbf5ea", bg2: "#f4e3bf", ink: "#241c14", soft: "#66574a", accent: "#c0532f", gold: "#e3a21a" },
  sham: { bg: "#f6efe1", bg2: "#e9dcbd", ink: "#1e1b2e", soft: "#57506a", accent: "#9b2335", gold: "#b8892b" },
} as const;
type Theme = keyof typeof THEMES;

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isAr = (s: string) => /[؀-ۿ]/.test(s);
const isTh = (s: string) => /[฀-๿]/.test(s);
const family = (s: string, display: boolean) =>
  isAr(s) ? (display ? "Amiri" : "IBM Plex Sans Arabic") : isTh(s) ? "Noto Sans Thai" : display ? "Fraunces" : "Noto Sans";
// rough advance widths (em) per script, good enough for line breaking
const charW = (c: string) => (/[؀-ۿ]/.test(c) ? 0.42 : /[฀-๿]/.test(c) ? (/[ัิ-ฺ็-๎]/.test(c) ? 0 : 0.56) : /[A-Z]/.test(c) ? 0.66 : /[ilj.,'’ ]/.test(c) ? 0.3 : 0.53);
const width = (s: string, size: number) => [...s].reduce((w, c) => w + charW(c), 0) * size;

/** Break text into lines ≤ maxW, using word segmentation (works for Thai, which has no spaces). */
function wrap(text: string, size: number, maxW: number, maxLines: number, lang: Lang) {
  const seg = new Intl.Segmenter(lang, { granularity: "word" });
  const words = [...seg.segment(text)].map((x) => x.segment);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (width(cur + w, size) > maxW && cur.trim()) { lines.push(cur.trim()); cur = w.trimStart(); }
    else cur += w;
  }
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S{0,6}$/, "") + "…";
    return kept;
  }
  return lines;
}

const ORNAMENT = `<pattern id="orn" width="56" height="56" patternUnits="userSpaceOnUse"><g fill="none" stroke="#b8892b" stroke-width="1.1" opacity=".35"><rect x="17" y="17" width="22" height="22"/><rect x="17" y="17" width="22" height="22" transform="rotate(45 28 28)"/><circle cx="28" cy="28" r="4.5"/></g></pattern>`;

const nested = (p: Page, x: number, y: number, size: number) =>
  p.spec ? panSVG(p.spec, `og-${p.slug}`, { steam: false }).replace("<svg ", `<svg x="${x}" y="${y}" width="${size}" height="${size}" `) : "";

function render(svg: string, w: number) {
  return new Resvg(svg, { font: { loadSystemFonts: false, fontFiles, defaultFontFamily: "Noto Sans" }, fitTo: { mode: "width", value: w } }).render().asPng();
}

function frame(theme: Theme, w: number, h: number, body: string) {
  const t = THEMES[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><radialGradient id="glow" cx="78%" cy="40%" r="60%"><stop offset="0" stop-color="${t.bg2}"/><stop offset="1" stop-color="${t.bg}"/></radialGradient>${theme === "sham" ? ORNAMENT : ""}</defs>
<rect width="${w}" height="${h}" fill="url(#glow)"/>${theme === "sham" ? `<rect width="${w}" height="${h}" fill="url(#orn)"/>` : ""}
<rect y="${h - 10}" width="${w}" height="10" fill="${t.gold}"/>${body}</svg>`;
}

/** Text block: kicker, title, optional local name, gloss lines, footer. Mirrors for RTL languages. */
function textBlock(lang: Lang, theme: Theme, o: { kicker: string; title: string; alt?: string; gloss?: string; footer?: string }, box: { x: number; w: number }) {
  const t = THEMES[theme];
  const rtl = isRtl(lang);
  const ax = rtl ? box.x + box.w : box.x;
  const anchor = rtl ? "end" : "start";
  const line = (s: string, y: number, size: number, fill: string, display: boolean, weight = display ? 700 : 500) =>
    `<text x="${ax}" y="${y}" font-family="${family(s, display)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${isAr(s) ? ' direction="rtl"' : ""}>${xml(s)}</text>`;
  let y = 120;
  const out: string[] = [line(`Khaorroz · ${o.kicker}`, y, 28, t.accent, false, 600)];
  y += 40;
  const titleSize = o.title.length > 22 ? 62 : 74;
  for (const l of wrap(o.title, titleSize, box.w, 2, lang)) { y += titleSize * 1.08; out.push(line(l, y, titleSize, t.ink, true)); }
  if (o.alt) { y += 46; out.push(line(wrap(o.alt, 34, box.w, 1, lang)[0], y, 34, t.accent, true, 600)); }
  if (o.gloss) { y += 18; for (const l of wrap(o.gloss, 32, box.w, 3, lang)) { y += 44; out.push(line(l, y, 32, t.soft, false)); } }
  if (o.footer) out.push(line(o.footer, 610, 26, t.soft, false, 600));
  return out.join("");
}

export function recipeCard(p: Page, lang: Lang, theme: Theme, kicker: string, footer: string) {
  const rtl = isRtl(lang);
  const pan = nested(p, rtl ? 30 : 690, 95, 480);
  const text = textBlock(lang, theme, { kicker, title: p.title, alt: p.altTitle && p.altTitle !== p.title ? p.altTitle : undefined, gloss: p.gloss, footer }, { x: rtl ? 560 : 70, w: 580 });
  return render(frame(theme, 1200, 675, pan + text), 1200);
}

export function squareCard(p: Page, theme: Theme) {
  return render(frame(theme, 800, 800, nested(p, 70, 70, 660)), 800);
}

export function collageCard(lang: Lang, theme: Theme, dishes: Page[], o: { kicker: string; title: string; gloss: string }) {
  const rtl = isRtl(lang);
  const [a, b, c] = dishes;
  const pans = [a && nested(a, rtl ? 40 : 720, 70, 380), b && nested(b, rtl ? 250 : 650, 330, 280), c && nested(c, rtl ? 20 : 930, 360, 240)].filter(Boolean).join("");
  const text = textBlock(lang, theme, { kicker: o.kicker, title: o.title, gloss: o.gloss }, { x: rtl ? 560 : 70, w: 580 });
  return render(frame(theme, 1200, 675, pans + text), 1200);
}
export type { Theme };
