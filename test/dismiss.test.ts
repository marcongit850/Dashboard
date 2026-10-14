import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { COPY } from "../src/copy";
import { buildDemoRaw } from "../src/demo";
import { dismissalKey, parseClearForm, sameOrigin } from "../src/dismiss";
import { issueSession, resetRateLimits } from "../src/gate";
import { renderBot, renderHome } from "../src/render";
import { buildModel, type BotCard } from "../src/state";
import type { Pull, RawData, StatusRow } from "../src/types";

const NOW = new Date("2026-10-14T18:00:00.000Z");
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

class MemoryKv {
  store = new Map<string, string>();
  async get(key: string | string[]): Promise<string | null | Map<string, string | null>> {
    if (Array.isArray(key)) {
      const found = new Map<string, string | null>();
      for (const item of key) found.set(item, this.store.get(item) ?? null);
      return found;
    }
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

function testEnv(kv?: MemoryKv): Env {
  return {
    ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
    POSTS_CSV_URL: "",
    STATUS_CSV_URL: "",
    DOCS_CSV_URL: "",
    BOT_REPO_MAP: "{}",
    ACCESS_AUD: "",
    ACCESS_TEAM_DOMAIN: "",
    BASE_PATH: "/dash",
    DASH_PASSWORD: "secret",
    DISMISSALS: kv,
  } as unknown as Env;
}

function raw(partial: Partial<RawData> = {}): RawData {
  return { posts: [], statuses: [], pulls: [], commits: [], docs: [], notes: [], ...partial };
}

function status(at: Date, botId: string, state: StatusRow["state"], task: string, needsMarc = false): StatusRow {
  return { at, botId, state, task, link: "", needsMarc };
}

function pull(createdAt: Date, botId: string, title: string): Pull {
  return { repo: "dashboard", title, branch: "main", url: `https://example.com/${title}`, createdAt, mergedAt: null, botId };
}

function bot(cards: BotCard[], id: string): BotCard {
  const found = cards.find((card) => card.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

describe("dismissals", () => {
  it("hides a cleared row and shows a newer needs_marc row", () => {
    const older = new Date("2026-10-14T15:00:00.000Z");
    const newer = new Date("2026-10-14T16:30:00.000Z");
    const key = dismissalKey("money-man", older);
    const hidden = buildModel(raw({
      statuses: [status(older, "money-man", "finished", "Old ask", true)],
      pulls: [pull(new Date(NOW.getTime() - 50 * 60 * 60 * 1000), "bob", "Budget draft")],
    }), NOW, { demo: false, loginEnabled: true, basePath: "/dash", dismissed: new Set([key]) });
    expect(bot(hidden.bots, "money-man")).toMatchObject({ attention: false, clear: null });
    expect(hidden.needs.map((item) => item.title)).toEqual(["Budget draft"]);
    expect(hidden.needs[0]?.clear).toBeNull();

    const again = buildModel(raw({
      statuses: [
        status(older, "money-man", "finished", "Old ask", true),
        status(newer, "money-man", "idle", "New ask", true),
      ],
    }), NOW, { demo: false, loginEnabled: true, dismissed: new Set([key]) });
    const card = bot(again.bots, "money-man");
    expect(card.attention).toBe(true);
    expect(card.clear).toEqual({ botId: "money-man", at: newer.toISOString() });
    expect(again.needs.map((item) => item.title)).toEqual(["money-man needs you"]);
    expect(again.needs[0]?.clear?.at).toBe(newer.toISOString());
  });

  it("puts Clear on each status item and on the bot page", () => {
    const page = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: true, basePath: "/dash", passwordGate: true });
    const html = renderHome(page);
    expect(html.match(/class="clear-form"/g)).toHaveLength(2);
    expect(html).toContain('action="/dash/clear"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="bot" value="money-man"');
    expect(html).toContain('name="bot" value="warden"');
    expect(html).toContain(`name="at" value="${bot(page.bots, "money-man").clear?.at}"`);
    expect(html).toContain('name="next" value="/dash?demo=1"');
    expect(html).toContain(`>${COPY.clear}<`);
    expect(html).not.toContain('name="bot" value="bob"');
    const money = renderBot(page, bot(page.bots, "money-man"));
    expect(money).toContain('action="/dash/clear"');
    expect(money).toContain('name="next" value="/dash/bot/money-man?demo=1"');
    expect(renderBot(page, bot(page.bots, "chief"))).not.toContain("clear-form");
  });

  it("accepts only a same-origin form for a known bot and timestamp", () => {
    const at = "2026-10-14T15:26:00.000Z";
    expect(parseClearForm(`bot=walton&at=${encodeURIComponent(at)}`)).toEqual({ botId: "walton", at: new Date(at) });
    expect(parseClearForm(`bot=nope&at=${encodeURIComponent(at)}`)).toBeNull();
    expect(parseClearForm("bot=walton&at=yesterday")).toBeNull();
    const ok = new Request("http://example.com/dash/clear", { method: "POST", headers: { origin: "http://example.com" } });
    const cross = new Request("http://example.com/dash/clear", { method: "POST", headers: { origin: "https://evil.test" } });
    const spoofed = new Request("http://example.com/dash/clear", {
      method: "POST",
      headers: { origin: "http://example.com", "sec-fetch-site": "cross-site" },
    });
    expect(sameOrigin(ok)).toBe(true);
    expect(sameOrigin(cross)).toBe(false);
    expect(sameOrigin(spoofed)).toBe(false);
    expect(sameOrigin(new Request("http://example.com/dash/clear", { method: "POST" }))).toBe(false);
  });

  it("stores a dismissal only for a signed-in same-origin post", async () => {
    resetRateLimits();
    const kv = new MemoryKv();
    const env = testEnv(kv);
    const at = "2026-10-14T15:26:00.000Z";
    const body = `bot=walton&at=${encodeURIComponent(at)}&next=/dash`;
    const anon = await worker.fetch(new Request("http://example.com/dash/clear", {
      method: "POST",
      headers: { origin: "http://example.com", "content-type": "application/x-www-form-urlencoded" },
      body,
    }), env, ctx);
    expect(anon.status).toBe(302);
    expect(anon.headers.get("location")).toContain("/dash/login");
    expect(kv.store.size).toBe(0);

    const token = await issueSession("secret");
    const cookie = `hq_session=${token}`;
    const foreign = await worker.fetch(new Request("http://example.com/dash/clear", {
      method: "POST",
      headers: { origin: "https://evil.test", cookie, "content-type": "application/x-www-form-urlencoded" },
      body,
    }), env, ctx);
    expect(foreign.status).toBe(403);
    expect(kv.store.size).toBe(0);

    const saved = await worker.fetch(new Request("http://example.com/dash/clear", {
      method: "POST",
      headers: { origin: "http://example.com", cookie, "content-type": "application/x-www-form-urlencoded" },
      body,
    }), env, ctx);
    expect(saved.status).toBe(303);
    expect(saved.headers.get("location")).toBe("http://example.com/dash");
    expect(kv.store.has(dismissalKey("walton", new Date(at)))).toBe(true);

    const missing = await worker.fetch(new Request("http://example.com/dash/clear", {
      method: "POST",
      headers: { origin: "http://example.com", cookie, "content-type": "application/x-www-form-urlencoded" },
      body,
    }), testEnv(), ctx);
    expect(missing.status).toBe(503);
    expect(await missing.text()).toContain(COPY.dismissalsOff);
  });
});
