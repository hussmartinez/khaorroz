// Khaorroz edge worker: permanent redirects from the old hostnames, everything else is the static build.
// (Worker name stays "khaorice" in wrangler.jsonc so the existing custom domains/DNS keep their owner.)
const CANONICAL = "khaorroz.forfreedom.app";
const OLD_HOSTS = new Set(["arroz.forfreedom.app", "khaorice.forfreedom.app"]);

interface Env { ASSETS: { fetch(req: Request): Promise<Response> } }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (OLD_HOSTS.has(url.hostname)) {
      url.hostname = CANONICAL;
      return Response.redirect(url.toString(), 301); // same path + query
    }
    return env.ASSETS.fetch(req);
  },
};
