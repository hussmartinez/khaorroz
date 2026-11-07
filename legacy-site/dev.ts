// Dev server: rebuilds on any change to the repo-root Markdown or site sources, serves dist/.
import { watch } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const DIST = join(import.meta.dir, "dist");
const PORT = Number(process.env.PORT ?? 4321);

const rebuild = () => Bun.spawnSync(["bun", join(import.meta.dir, "build.ts")], { stdout: "inherit", stderr: "inherit" });
rebuild();

let t: Timer | undefined;
const schedule = () => { clearTimeout(t); t = setTimeout(rebuild, 150); };
watch(ROOT, (_, f) => f?.endsWith(".md") && schedule());
watch(join(import.meta.dir, "assets"), schedule);
watch(join(import.meta.dir, "build.ts"), schedule);

Bun.serve({
  port: PORT,
  hostname: process.env.HOST ?? "127.0.0.1",
  async fetch(req) {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p.endsWith("/")) p += "index.html";
    if (p.includes("..")) return new Response("bad path", { status: 400 });
    const f = Bun.file(join(DIST, p));
    return (await f.exists()) ? new Response(f) : new Response("Not found", { status: 404 });
  },
});
console.log(`dev server → http://${process.env.HOST ?? "127.0.0.1"}:${PORT}`);
