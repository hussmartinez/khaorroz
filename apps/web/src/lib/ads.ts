// Ad slots: fixed-size reserved spaces (no layout shift once a network is plugged in). Configure in ads.json.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type AdKind = "banner" | "inFeed" | "inArticle" | "sidebar";
// Resolved from the app directory (the build runs there; bundling relocates import.meta.url).
const file = join(process.cwd(), "ads.json");
if (!existsSync(file)) console.warn(`[ads] ${file} not found — ad slots disabled`);
export const ADS: { mode: "placeholder" | "off" | "live"; head: string; slots: Partial<Record<AdKind, string>> } =
  existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { mode: "off", head: "", slots: {} };
export const AD_SIZE: Record<AdKind, string> = { banner: "728 × 90", inFeed: "300 × 250", inArticle: "336 × 280", sidebar: "300 × 600" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function adHtml(kind: AdKind, label: string) {
  if (ADS.mode === "off") return "";
  const inner = ADS.mode === "live" ? ADS.slots[kind] ?? "" : `<span class="ad-ph">${AD_SIZE[kind]}</span>`;
  return `<aside class="ad ad-${kind}${ADS.mode === "placeholder" ? " is-placeholder" : ""}" aria-label="${esc(label)}" data-pagefind-ignore><span class="ad-label">${esc(label)}</span><div class="ad-slot">${inner}</div></aside>`;
}
