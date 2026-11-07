// Khaorroz edge worker: permanent redirects from the old hostnames, everything else is the static build.
// (Worker name stays "khaorice" in wrangler.jsonc so the existing custom domains/DNS keep their owner.)
const CANONICAL = "khaorroz.forfreedom.app";
const OLD_HOSTS = new Set(["arroz.forfreedom.app", "khaorice.forfreedom.app"]);

// Fingerprinted/rarely-changing files get long caching; HTML keeps the platform default (revalidate).
function cacheControl(path: string): string | undefined {
  if (path.startsWith("/_astro/") || path.startsWith("/fonts/")) return "public, max-age=31536000, immutable";
  if (path.startsWith("/pans/") || path.startsWith("/og/") || path.startsWith("/icons/") || /\.(ico|png|svg|webp|jpg)$/.test(path)) return "public, max-age=86400";
  if (/\.(css|js)$/.test(path) || path.startsWith("/pagefind/")) return "public, max-age=3600";
  if (/\.(txt|md|xml)$/.test(path)) return "public, max-age=3600";
  return undefined;
}

interface Env { ASSETS: { fetch(req: Request): Promise<Response> } }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (OLD_HOSTS.has(url.hostname)) {
      url.hostname = CANONICAL;
      return Response.redirect(url.toString(), 301); // same path + query
    }
    const res = await env.ASSETS.fetch(req);
    const cc = cacheControl(url.pathname);
    if (!cc || res.status !== 200) return res;
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", cc);
    return out;
  },
};
