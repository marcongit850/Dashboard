import "./secrets";
import { authorize } from "./access";
import { COPY } from "./copy";
import { buildDemoRaw } from "./demo";
import { loadRaw } from "./load";
import { renderBot, renderCrash, renderDocs, renderHome, renderMissing } from "./render";
import { buildModel, cardBySlug } from "./state";
import { findBot } from "./bots";

const HTML: HeadersInit = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; script-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "x-frame-options": "DENY",
};

function text(body: string, status: number, extra: HeadersInit = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

function assetRequest(url: URL, request: Request): Request | null {
  if (url.pathname === "/favicon.ico") return new Request(new URL("/favicon.svg", url.origin), request);
  if (url.pathname === "/hq.css" || url.pathname === "/favicon.svg") return request;
  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const started = Date.now();
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return text(COPY.methodNotAllowed, 405, { allow: "GET, HEAD" });
    }
    const auth = await authorize(request, env);
    if (!auth.ok) {
      console.log(JSON.stringify({ event: "access_denied", path: url.pathname }));
      return text(COPY.forbidden, 403);
    }
    const asset = assetRequest(url, request);
    if (asset) return env.ASSETS.fetch(asset);

    const demo = url.searchParams.get("demo") === "1";
    const now = new Date();
    try {
      const raw = demo ? buildDemoRaw(now) : await loadRaw(env, ctx);
      const model = buildModel(raw, now, { demo, loginEnabled: auth.loginEnabled });
      if (url.pathname === "/") {
        console.log(JSON.stringify({ event: "page", path: "/", demo, ms: Date.now() - started, notes: model.notes.length }));
        return new Response(renderHome(model), { headers: HTML });
      }
      if (url.pathname === "/docs" || url.pathname === "/docs/") {
        console.log(JSON.stringify({ event: "page", path: "/docs", demo, ms: Date.now() - started, docs: model.docs.length }));
        return new Response(renderDocs(model), { headers: HTML });
      }
      const match = url.pathname.match(/^\/bot\/([a-z0-9-]+)\/?$/);
      if (match) {
        const slug = match[1] ?? "";
        const known = findBot(slug);
        const card = known ? cardBySlug(model, known.slug) : undefined;
        if (!card) return new Response(renderMissing(model, true), { status: 404, headers: HTML });
        console.log(JSON.stringify({ event: "page", path: "/bot/:slug", slug: card.slug, demo, ms: Date.now() - started }));
        return new Response(renderBot(model, card), { headers: HTML });
      }
      return new Response(renderMissing(model, false), { status: 404, headers: HTML });
    } catch {
      console.error(JSON.stringify({ event: "page_failed", path: url.pathname }));
      return new Response(renderCrash(), { status: 500, headers: HTML });
    }
  },
} satisfies ExportedHandler<Env>;
