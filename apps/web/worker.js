// Fallback for requests that don't match a built file exactly.
// Static assets are served first (html_handling: "none", so /x.html stays /x.html,
// matching the canonical URLs); only unmatched paths reach this script:
//   "/" , "/es/" …  → the directory's index.html
//   anything else   → /404.html with status 404
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/")) {
      const index = await env.ASSETS.fetch(new URL(url.pathname + "index.html", url));
      if (index.ok) return index;
    }
    const notFound = await env.ASSETS.fetch(new URL("/404.html", url));
    return new Response(notFound.body, {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
