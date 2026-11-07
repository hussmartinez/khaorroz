// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Sitemap URLs must match the canonical URLs in Layout.astro: clean URLs (no ".html"), language homes end in "/".
const canon = (u) => {
  const url = new URL(u);
  if (/^\/(es|ca|th|ar)?\/?$/.test(url.pathname)) url.pathname = url.pathname.replace(/\/?$/, "/");
  else url.pathname = url.pathname.replace(/(\/index)?\.html$/, "").replace(/\/$/, "");
  return url.href;
};

export default defineConfig({
  site: "https://khaorroz.forfreedom.app",
  // Files are emitted as /recipes/paella-valenciana.html, /es/index.html …; Cloudflare serves them at clean URLs.
  build: { format: "preserve" },
  trailingSlash: "ignore",
  // Lossless whitespace handling (Astro 7's default 'jsx' mode can drop spaces between inline elements).
  compressHTML: true,
  integrations: [
    sitemap({
      i18n: { defaultLocale: "en", locales: { en: "en", es: "es", ca: "ca", th: "th", ar: "ar" } },
      filter: (page) => !/\/404(\.html)?$/.test(page),
      serialize: (item) => ({ ...item, url: canon(item.url), links: item.links?.map((l) => ({ ...l, url: canon(l.url) })) }),
    }),
  ],
  vite: { server: { fs: { allow: ["../.."] } } },
});
