// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Sitemap URLs must match the canonical URLs in Layout.astro: pages keep ".html", language homes end in "/".
const canon = (u) => {
  const url = new URL(u);
  if (/^\/(es|ca|th)?\/?$/.test(url.pathname)) url.pathname = url.pathname.replace(/\/?$/, "/");
  else if (!/\.html$/.test(url.pathname)) url.pathname = url.pathname.replace(/\/$/, "") + ".html";
  return url.href;
};

export default defineConfig({
  site: "https://arroz.forfreedom.app",
  // Keep the existing URL scheme: /recipes/paella-valenciana.html, /es/index.html, …
  build: { format: "preserve" },
  trailingSlash: "ignore",
  // Lossless whitespace handling (Astro 7's default 'jsx' mode can drop spaces between inline elements).
  compressHTML: true,
  integrations: [
    sitemap({
      i18n: { defaultLocale: "en", locales: { en: "en", es: "es", ca: "ca", th: "th" } },
      filter: (page) => !/\/404(\.html)?$/.test(page),
      serialize: (item) => ({ ...item, url: canon(item.url), links: item.links?.map((l) => ({ ...l, url: canon(l.url) })) }),
    }),
  ],
  vite: { server: { fs: { allow: ["../.."] } } },
});
