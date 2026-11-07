// robots.txt: open to search engines and AI search/answer crawlers, with Cloudflare Content Signals.
import type { APIRoute } from "astro";
import { SITE } from "../lib/seo";

// Content Signals (https://contentsignals.org): search = indexing, ai-input = grounding answers
// (RAG/AI search), ai-train = model training. ai-train is the site owner's call — flip to "no" here.
const AI_TRAIN = "yes";
const BOTS = [
  "Googlebot", "Bingbot", "DuckDuckBot", "Applebot", "YandexBot", "Baiduspider",
  "OAI-SearchBot", "ChatGPT-User", "GPTBot", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "meta-externalagent",
  "MistralAI-User", "cohere-ai",
];
export const GET: APIRoute = () => {
  const groups = BOTS.map((b) => `User-agent: ${b}\nAllow: /\nDisallow: /pagefind/`).join("\n\n");
  const body = `# Khaorroz — traditional rice recipes and their history. Crawling and citation welcome.
# LLM-friendly index: ${SITE}/llms.txt · full corpus: ${SITE}/llms-full.txt · Markdown of any recipe: append .md to its URL

User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=${AI_TRAIN}
Allow: /
Disallow: /pagefind/

${groups}

Sitemap: ${SITE}/sitemap-index.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
