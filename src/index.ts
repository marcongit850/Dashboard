import "./secrets";
import { authorize } from "./access";
import { COPY } from "./copy";
import { attentionRows, loadDismissals, parseClearForm, sameOrigin, saveDismissal } from "./dismiss";
import { buildDemoRaw } from "./demo";
import {
  clearFailures,
  clearSessionCookie,
  clientIp,
  cookieKey,
  noteFailure,
  passwordConfigured,
  passwordsMatch,
  rateLimited,
  requestHasSession,
  sessionCookie,
  issueSession,
} from "./gate";
import { loadRaw } from "./load";
import { baseHit, logicalPath, normalizeBase, safeNext, withBase } from "./paths";
import { renderBot, renderCrash, renderDocs, renderHome, renderLogin, renderMissing } from "./render";
import { buildModel, cardBySlug } from "./state";
import { findBot } from "./bots";

const HTML: HeadersInit = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "content-security-policy": "default-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "x-frame-options": "DENY",
};

function text(body: string, status: number, extra: HeadersInit = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

function html(body: string, status = 200, extra: HeadersInit = {}): Response {
  const headers = new Headers(HTML);
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return new Response(body, { status, headers });
}

const PUBLIC_FILES = new Set(["/hq.css", "/candy.js", "/candy-girl.png", "/candy-girl.webp"]);

function assetRequest(logical: string, url: URL): Request | null {
  if (logical === "/favicon.ico" || logical === "/favicon.svg") {
    return new Request(new URL("/favicon.svg", url.origin));
  }
  if (PUBLIC_FILES.has(logical)) return new Request(new URL(logical, url.origin));
  return null;
}

function redirect(url: string, status: 302 | 303, extra: HeadersInit = {}): Response {
  const headers = new Headers({ location: url, "cache-control": "no-store", ...extra });
  return new Response(null, { status, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const started = Date.now();
    const url = new URL(request.url);
    const base = normalizeBase(env.BASE_PATH);
    const hit = baseHit(url.pathname, base);
    if (hit === "root") {
      const dest = new URL(withBase(base, "/"), url.origin);
      dest.search = url.search;
      return redirect(dest.toString(), 302);
    }
    if (hit === "out") return text(COPY.notHere, 404);

    const logical = logicalPath(url.pathname, base);
    const postOk = request.method === "POST" && (logical === "/login" || logical === "/logout" || logical === "/clear");
    if (request.method !== "GET" && request.method !== "HEAD" && !postOk) {
      return text(COPY.methodNotAllowed, 405, { allow: "GET, HEAD, POST" });
    }

    const auth = await authorize(request, env);
    if (!auth.ok) {
      console.log(JSON.stringify({ event: "access_denied", path: url.pathname }));
      return text(COPY.forbidden, 403);
    }
    if (!passwordConfigured(env.DASH_PASSWORD)) {
      console.log(JSON.stringify({ event: "password_missing", path: url.pathname }));
      return text(COPY.passwordMissing, 403);
    }

    const secret = cookieKey(env.DASH_PASSWORD, env.DASH_COOKIE_SECRET);
    const authed = await requestHasSession(request, secret);

    if (logical === "/login") {
      if (request.method === "POST") return submitLogin(request, env, url, base, secret);
      if (authed) {
        const next = new URL(safeNext(base, url.searchParams.get("next"), url.origin), url.origin);
        return redirect(next.toString(), 302);
      }
      const next = url.searchParams.get("next") ?? "";
      return html(renderLogin({ basePath: base, error: "", next }));
    }

    if (logical === "/logout") {
      console.log(JSON.stringify({ event: "logout", path: url.pathname }));
      return redirect(new URL(withBase(base, "/login"), url.origin).toString(), 303, {
        "set-cookie": clearSessionCookie(base),
      });
    }

    const asset = assetRequest(logical, url);
    if (asset) return env.ASSETS.fetch(asset);

    if (!authed) {
      const login = new URL(withBase(base, "/login"), url.origin);
      login.searchParams.set("next", `${url.pathname}${url.search}`);
      return redirect(login.toString(), 302);
    }

    if (logical === "/clear") return submitClear(request, env, url, base);

    const demo = url.searchParams.get("demo") === "1";
    const now = new Date();
    try {
      const raw = demo ? buildDemoRaw(now) : await loadRaw(env, ctx);
      const dismissed = await loadDismissals(env.DISMISSALS, attentionRows(raw.statuses));
      const model = buildModel(raw, now, { demo, loginEnabled: auth.loginEnabled, basePath: base, passwordGate: true, dismissed });
      if (logical === "/") {
        console.log(JSON.stringify({ event: "page", path: withBase(base, "/"), demo, ms: Date.now() - started, notes: model.notes.length }));
        return html(renderHome(model));
      }
      if (logical === "/docs") {
        console.log(JSON.stringify({ event: "page", path: withBase(base, "/docs"), demo, ms: Date.now() - started, docs: model.docs.length }));
        return html(renderDocs(model));
      }
      const match = logical.match(/^\/bot\/([a-z0-9-]+)$/);
      if (match) {
        const slug = match[1] ?? "";
        const known = findBot(slug);
        const card = known ? cardBySlug(model, known.slug) : undefined;
        if (!card) return html(renderMissing(model, true), 404);
        console.log(JSON.stringify({ event: "page", path: "/bot/:slug", slug: card.slug, demo, ms: Date.now() - started }));
        return html(renderBot(model, card));
      }
      return html(renderMissing(model, false), 404);
    } catch {
      console.error(JSON.stringify({ event: "page_failed", path: url.pathname }));
      return html(renderCrash(base), 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function submitLogin(request: Request, env: Env, url: URL, base: string, secret: string): Promise<Response> {
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    console.log(JSON.stringify({ event: "login_limited" }));
    return html(renderLogin({ basePath: base, error: COPY.loginLimited, next: "" }), 429);
  }
  let body = "";
  try {
    body = await request.text();
  } catch {
    body = "";
  }
  if (body.length > 2048) body = "";
  const params = new URLSearchParams(body);
  const supplied = params.get("password") ?? "";
  const expected = env.DASH_PASSWORD?.trim() ?? "";
  const ok = expected.length > 0 && (await passwordsMatch(supplied, expected));
  if (!ok) {
    noteFailure(ip);
    console.log(JSON.stringify({ event: "login_failed" }));
    return html(renderLogin({ basePath: base, error: COPY.loginWrong, next: params.get("next") ?? "" }), 401);
  }
  clearFailures(ip);
  const token = await issueSession(secret);
  const next = new URL(safeNext(base, params.get("next"), url.origin), url.origin).toString();
  console.log(JSON.stringify({ event: "login_ok" }));
  return redirect(next, 303, { "set-cookie": sessionCookie(token, base) });
}

async function submitClear(request: Request, env: Env, url: URL, base: string): Promise<Response> {
  if (request.method !== "POST") return text(COPY.methodNotAllowed, 405, { allow: "POST" });
  if (!sameOrigin(request)) {
    console.log(JSON.stringify({ event: "dismiss_origin" }));
    return text(COPY.forbidden, 403);
  }
  let body = "";
  try {
    body = await request.text();
  } catch {
    body = "";
  }
  if (body.length > 2048) body = "";
  const parsed = parseClearForm(body);
  if (!parsed) {
    console.log(JSON.stringify({ event: "dismiss_bad" }));
    return text(COPY.dismissFailed, 400);
  }
  const saved = await saveDismissal(env.DISMISSALS, parsed.botId, parsed.at);
  if (saved === "missing") return text(COPY.dismissalsOff, 503);
  if (saved === "failed") return text(COPY.dismissFailed, 503);
  const params = new URLSearchParams(body);
  const next = new URL(safeNext(base, params.get("next"), url.origin), url.origin);
  console.log(JSON.stringify({ event: "dismiss", bot: parsed.botId }));
  return redirect(next.toString(), 303);
}
