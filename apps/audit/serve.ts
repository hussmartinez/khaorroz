// Static preview of apps/web/dist with the Worker's clean-URL behaviour (/x → x.html, /x/ → x/index.html, else 404.html).
import { join } from "node:path";
const DIST = process.argv[2] ?? join(import.meta.dir, "../web/dist");
const PORT = Number(process.argv[3] ?? 4330);
Bun.serve({ port: PORT, hostname: "127.0.0.1", async fetch(req) {
  const p = decodeURIComponent(new URL(req.url).pathname);
  for (const c of [p, p + ".html", join(p, "index.html")]) {
    const f = Bun.file(join(DIST, c));
    if (!c.endsWith("/") && (await f.exists())) return new Response(f);
  }
  return new Response(Bun.file(join(DIST, "404.html")), { status: 404, headers: { "content-type": "text/html" } });
} });
console.log(`preview http://127.0.0.1:${PORT}`);
