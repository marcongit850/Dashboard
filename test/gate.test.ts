import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { COPY } from "../src/copy";
import { buildDemoRaw } from "../src/demo";
import {
  clearSessionCookie,
  cookieKey,
  issueSession,
  passwordsMatch,
  resetRateLimits,
  sessionCookie,
  sessionValid,
  timingSafeEqual,
  SESSION_SECONDS,
} from "../src/gate";
import { baseHit, logicalPath, normalizeBase, safeNext, withBase } from "../src/paths";
import { renderHome, renderLogin } from "../src/render";
import { buildModel } from "../src/state";

const NOW = new Date("2026-10-14T20:00:00.000Z");
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

function testEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    ASSETS: {
      fetch: async (input: RequestInfo) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        return new Response("asset", { status: 200, headers: { "content-type": "text/css", "x-asset-path": url.pathname } });
      },
    },
    POSTS_CSV_URL: "",
    STATUS_CSV_URL: "",
    DOCS_CSV_URL: "",
    BOT_REPO_MAP: "{}",
    ACCESS_AUD: "",
    ACCESS_TEAM_DOMAIN: "",
    BASE_PATH: "/dash",
    DASH_PASSWORD: "secret",
    ...overrides,
  } as unknown as Env;
}

async function login(env: Env, body: string, ip = "203.0.113.10"): Promise<Response> {
  return worker.fetch(new Request("http://example.com/dash/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip },
    body,
  }), env, ctx);
}

function cookiePair(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? "";
  return raw.split(";")[0] ?? "";
}

beforeEach(() => {
  resetRateLimits();
});

describe("base path", () => {
  it("normalizes the prefix and keeps links under it", () => {
    expect(normalizeBase("")).toBe("");
    expect(normalizeBase("/")).toBe("");
    expect(normalizeBase("/dash/")).toBe("/dash");
    expect(normalizeBase("dash")).toBe("/dash");
    expect(normalizeBase("/dash/../x")).toBe("");
    expect(withBase("/dash", "/")).toBe("/dash");
    expect(withBase("/dash", "/docs")).toBe("/dash/docs");
    expect(withBase("", "/docs")).toBe("/docs");
    expect(logicalPath("/dash/bot/chief/", "/dash")).toBe("/bot/chief");
    expect(logicalPath("/dash", "/dash")).toBe("/");
    expect(baseHit("/", "/dash")).toBe("root");
    expect(baseHit("/dash/login", "/dash")).toBe("in");
    expect(baseHit("/docs", "/dash")).toBe("out");
    expect(safeNext("/dash", "https://evil.test/phish", "http://example.com")).toBe("/dash");
    expect(safeNext("/dash", "//evil.test", "http://example.com")).toBe("/dash");
    expect(safeNext("/dash", "/docs", "http://example.com")).toBe("/dash");
    expect(safeNext("/dash", "/dash/login", "http://example.com")).toBe("/dash");
    expect(safeNext("/dash", "/dash/clear", "http://example.com")).toBe("/dash");
    expect(safeNext("/dash", "/dash/docs?demo=1#team", "http://example.com")).toBe("/dash/docs?demo=1#team");

    const page = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: true, basePath: "/dash" });
    const html = renderHome(page);
    expect(html).toContain('href="/dash/hq.css"');
    expect(html).toContain('href="/dash/favicon.svg"');
    expect(html).toContain('href="/dash?demo=1"');
    expect(html).toContain('href="/dash/docs?demo=1"');
    expect(html).toContain('href="/dash/bot/chief?demo=1"');
    expect(html).toContain('href="/dash/logout"');
    expect(html).not.toContain('href="/hq.css"');
    expect(html).not.toContain('href="/docs?demo=1"');
    expect(html.match(/class="seat /g)).toHaveLength(13);
    expect(html).toContain("Outreach");
    expect(html).toContain(COPY.logout);
  });
});

describe("session cookie", () => {
  it("compares in constant time and signs a 7 day cookie", async () => {
    const same = new Uint8Array([1, 2, 3]);
    expect(timingSafeEqual(same, new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(same, new Uint8Array([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(same, new Uint8Array([1, 2]))).toBe(false);
    expect(await passwordsMatch("secret", "secret")).toBe(true);
    expect(await passwordsMatch("a", "abcdef")).toBe(false);

    const now = Date.parse("2026-10-14T15:00:00.000Z");
    const token = await issueSession("secret", now);
    expect(await sessionValid(token, "secret", now)).toBe(true);
    expect(await sessionValid(token, "other", now)).toBe(false);
    expect(await sessionValid(`${token}x`, "secret", now)).toBe(false);
    const [version, exp] = token.split(".");
    expect(await sessionValid(`${version}.${exp}.aaaa`, "secret", now)).toBe(false);
    expect(await sessionValid(token, "secret", now + SESSION_SECONDS * 1000)).toBe(false);
    expect(cookieKey("secret", " ")).toBe("secret");
    expect(cookieKey("secret", "dedicated")).toBe("dedicated");
    const dedicated = await issueSession("dedicated", now);
    expect(await sessionValid(dedicated, "dedicated", now)).toBe(true);
    expect(await sessionValid(dedicated, "secret", now)).toBe(false);

    const header = sessionCookie(token, "/dash");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/dash");
    expect(header).toContain(`Max-Age=${SESSION_SECONDS}`);
    expect(clearSessionCookie("/dash")).toContain("Max-Age=0");
    expect(clearSessionCookie("/dash")).toContain("Path=/dash");
  });
});

describe("password gate", () => {
  it("denies access when the password secret is missing", async () => {
    const env = testEnv({ DASH_PASSWORD: "  " });
    const home = await worker.fetch(new Request("http://example.com/dash"), env, ctx);
    expect(home.status).toBe(403);
    expect(await home.text()).toBe(COPY.passwordMissing);
    const form = await worker.fetch(new Request("http://example.com/dash/login"), env, ctx);
    expect(form.status).toBe(403);
    expect(await form.text()).not.toContain("<form");
  });

  it("keeps Access in front of the password form", async () => {
    const partial = testEnv({ ACCESS_AUD: "aud" });
    const denied = await worker.fetch(new Request("http://example.com/dash/login"), partial, ctx);
    expect(denied.status).toBe(403);
    expect(await denied.text()).toBe(COPY.forbidden);
    const both = testEnv({ ACCESS_AUD: "aud", ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com" });
    const missingJwt = await worker.fetch(new Request("http://example.com/dash?demo=1"), both, ctx);
    expect(missingJwt.status).toBe(403);
    expect(await missingJwt.text()).toBe(COPY.forbidden);
  });

  it("serves login, assets, and the office under /dash", async () => {
    const env = testEnv();
    const root = await worker.fetch(new Request("http://example.com/?demo=1"), env, ctx);
    expect(root.status).toBe(302);
    expect(root.headers.get("location")).toBe("http://example.com/dash?demo=1");

    const outside = await worker.fetch(new Request("http://example.com/docs"), env, ctx);
    expect(outside.status).toBe(404);

    const locked = await worker.fetch(new Request("http://example.com/dash?demo=1"), env, ctx);
    expect(locked.status).toBe(302);
    expect(locked.headers.get("location")).toContain("http://example.com/dash/login?next=");
    expect(locked.headers.get("location")).toContain("demo%3D1");

    const form = await worker.fetch(new Request("http://example.com/dash/login?next=/dash/docs"), env, ctx);
    expect(form.status).toBe(200);
    const formHtml = await form.text();
    expect(formHtml).toContain('action="/dash/login"');
    expect(formHtml).toContain('href="/dash/hq.css"');
    expect(formHtml).toContain('name="password"');
    expect(formHtml).not.toContain("<script");
    expect(formHtml).not.toContain("Chief");
    expect(renderLogin({ basePath: "/dash", error: COPY.loginWrong, next: "/dash" })).toContain(COPY.loginWrong);

    const css = await worker.fetch(new Request("http://example.com/dash/hq.css"), env, ctx);
    expect(css.status).toBe(200);
    expect(css.headers.get("x-asset-path")).toBe("/hq.css");

    const wrong = await login(env, "password=nope&next=/dash");
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();
    expect(await wrong.text()).toContain(COPY.loginWrong);

    const badNext = await login(env, "password=secret&next=https://evil.test/phish");
    expect(badNext.status).toBe(303);
    expect(badNext.headers.get("location")).toBe("http://example.com/dash");
    const issued = badNext.headers.get("set-cookie") ?? "";
    expect(issued).toContain("HttpOnly");
    expect(issued).toContain("Secure");
    expect(issued).toContain("SameSite=Lax");
    expect(issued).toContain("Path=/dash");
    expect(issued).toContain(`Max-Age=${SESSION_SECONDS}`);

    const good = await login(env, "password=secret&next=/dash/docs%3Fdemo%3D1");
    expect(good.headers.get("location")).toBe("http://example.com/dash/docs?demo=1");
    const office = await worker.fetch(new Request("http://example.com/dash?demo=1", {
      headers: { cookie: cookiePair(good) },
    }), env, ctx);
    expect(office.status).toBe(200);
    expect(office.headers.get("referrer-policy")).toBe("same-origin");
    const officeHtml = await office.text();
    expect(officeHtml.match(/class="seat /g)).toHaveLength(13);
    expect(officeHtml).toContain('href="/dash/hq.css"');
    expect(officeHtml).toContain('href="/dash/logout"');
    expect(officeHtml).toContain("at-12");
    expect(officeHtml).not.toContain(COPY.loginNotice);

    const docs = await worker.fetch(new Request("http://example.com/dash/docs?demo=1", {
      headers: { cookie: cookiePair(good) },
    }), env, ctx);
    expect(docs.status).toBe(200);
    expect(await docs.text()).toContain('href="/dash?demo=1"');

    const idle = await worker.fetch(new Request("http://example.com/dash/bot/outreach?demo=1", {
      headers: { cookie: cookiePair(good) },
    }), env, ctx);
    expect(idle.status).toBe(200);
    const idleHtml = await idle.text();
    expect(idleHtml).toContain("Outreach");
    expect(idleHtml).not.toContain(COPY.loginNotice);
    expect(idleHtml).toContain(COPY.leaning);
    expect(idleHtml).toContain('href="/dash?demo=1"');

    const forged = await worker.fetch(new Request("http://example.com/dash?demo=1", {
      headers: { cookie: "hq_session=v1.1.bogus" },
    }), env, ctx);
    expect(forged.status).toBe(302);

    const out = await worker.fetch(new Request("http://example.com/dash/logout", {
      headers: { cookie: cookiePair(good) },
    }), env, ctx);
    expect(out.status).toBe(303);
    expect(out.headers.get("location")).toBe("http://example.com/dash/login");
    const cleared = out.headers.get("set-cookie") ?? "";
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("Path=/dash");
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("Secure");
  });

  it("rate limits repeated wrong passwords", async () => {
    const env = testEnv();
    for (let i = 0; i < 8; i += 1) {
      const res = await login(env, "password=nope", "203.0.113.50");
      expect(res.status).toBe(401);
    }
    const limited = await login(env, "password=secret", "203.0.113.50");
    expect(limited.status).toBe(429);
    expect(await limited.text()).toContain(COPY.loginLimited);
    const other = await login(env, "password=secret", "203.0.113.51");
    expect(other.status).toBe(303);
  });
});
