import { describe, expect, it } from "vitest";
import { accessMode, teamIssuer } from "../src/access";
import { CACHE_TTL_SECONDS } from "../src/cache";
import { buildDemoRaw } from "../src/demo";
import { attributeBot, parseGraphqlBody, parseRepoMap, parseSearchBody } from "../src/github";
import { buildModel, type BotCard } from "../src/state";
import { ctWallToUtc, DAY_MS, TWO_HOURS_MS } from "../src/time";
import type { Post, Pull, RawData, StatusRow } from "../src/types";

const NOW = new Date("2026-10-14T20:00:00.000Z");

function raw(partial: Partial<RawData> = {}): RawData {
  return { posts: [], statuses: [], pulls: [], commits: [], notes: [], ...partial };
}

function post(at: Date, botId: string, topic: string): Post {
  return {
    at,
    botId,
    source: "Posts",
    site: "Walton County Updates",
    platform: "Facebook",
    account: "",
    status: "posted",
    topic,
    url: "",
    notes: "",
  };
}

function status(at: Date, botId: string, state: StatusRow["state"], task: string, needsMarc = false): StatusRow {
  return { at, botId, state, task, link: "", needsMarc };
}

function pull(createdAt: Date, mergedAt: Date | null, botId: string, title: string): Pull {
  return { repo: "dashboard", title, branch: "main", url: `https://example.com/${title}`, createdAt, mergedAt, botId };
}

function model(data: RawData, now = NOW) {
  return buildModel(data, now, { demo: false, loginEnabled: true });
}

function bot(cards: BotCard[], id: string): BotCard {
  const found = cards.find((card) => card.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

describe("state", () => {
  it("keeps the upstream cache at about 5 minutes", () => {
    expect(CACHE_TTL_SECONDS).toBe(300);
  });

  it("is busy for started, or for activity inside 2 hours", () => {
    const started = model(raw({
      statuses: [status(new Date(NOW.getTime() - 10 * DAY_MS), "chief", "started", "Review the board")],
    }));
    expect(bot(started.bots, "chief").busy).toBe(true);
    expect(bot(started.bots, "chief").bubble).toBe("Review the board");

    const recent = model(raw({
      statuses: [status(new Date(NOW.getTime() - 60_000), "walton", "idle", "")],
      posts: [post(new Date(NOW.getTime() - TWO_HOURS_MS), "walton", "Flags")],
    }));
    expect(bot(recent.bots, "walton").busy).toBe(true);
    expect(bot(recent.bots, "walton").bubble).toBe("Flags");

    const stale = model(raw({
      posts: [post(new Date(NOW.getTime() - TWO_HOURS_MS - 1), "walton", "Flags")],
    }));
    expect(bot(stale.bots, "walton").busy).toBe(false);
    expect(bot(stale.bots, "walton").bubble).toBe("");
    expect(bot(stale.bots, "walton").workingNow).toBe("Idle");
  });

  it("lets a newer idle row replace started, and keeps finished separate", () => {
    const page = model(raw({
      statuses: [
        status(new Date(NOW.getTime() - 30 * 3_600_000), "chief", "finished", "Ship the note"),
        status(new Date(NOW.getTime() - 3_600_000), "chief", "started", "Review"),
        status(new Date(NOW.getTime() - 60_000), "bob", "idle", "Waiting"),
        status(new Date(NOW.getTime() - 2 * 3_600_000), "bob", "started", "Old task"),
      ],
    }));
    const chief = bot(page.bots, "chief");
    expect(chief.busy).toBe(true);
    expect(chief.workingNow).toBe("Review");
    expect(chief.finishedLine).toContain("Ship the note");
    expect(chief.finishedLine).toContain("CT");
    const builder = bot(page.bots, "bob");
    expect(builder.busy).toBe(false);
    expect(builder.workingNow).toBe("Idle");
    expect(builder.finishedLine).toBe("Nothing finished yet");
  });

  it("marks blocked and needs_marc without forcing a typing pose", () => {
    const page = model(raw({
      statuses: [
        status(new Date(NOW.getTime() - 5 * 3_600_000), "warden", "blocked", "Waiting on a policy check", false),
        status(new Date(NOW.getTime() - DAY_MS), "money-man", "blocked", "old", true),
        status(new Date(NOW.getTime() - 3_600_000), "money-man", "idle", "Cleared", false),
        status(new Date(NOW.getTime() - 2 * 3_600_000), "foody", "finished", "Guide", true),
      ],
    }));
    const warden = bot(page.bots, "warden");
    expect(warden.busy).toBe(false);
    expect(warden.attention).toBe(true);
    expect(warden.workingNow).toBe("Waiting on a policy check");
    expect(page.needs.some((item) => item.title === "Warden is blocked")).toBe(true);
    expect(bot(page.bots, "money-man").attention).toBe(false);
    const foody = bot(page.bots, "foody");
    expect(foody.attention).toBe(true);
    expect(foody.busy).toBe(false);
    expect(page.needs.some((item) => item.title === "Foody needs you")).toBe(true);
  });

  it("includes open PRs older than 24 hours and skips younger ones", () => {
    const page = model(raw({
      pulls: [
        pull(new Date(NOW.getTime() - 50 * 3_600_000), null, "money-man", "Budget draft"),
        pull(new Date(NOW.getTime() - DAY_MS), null, "bob", "Try a font"),
        pull(new Date(NOW.getTime() - 2 * DAY_MS), new Date(NOW.getTime() - 3_600_000), "bob", "Merged already"),
      ],
    }));
    expect(page.needs.map((item) => item.title)).toEqual(["Budget draft"]);
    expect(page.needs[0]?.detail).toContain("2 days old");
    expect(bot(page.bots, "bob").busy).toBe(true);
  });

  it("buckets posts Monday through Sunday in Central Time", () => {
    const monday = ctWallToUtc(2026, 10, 12, 10, 0, 0);
    const sunday = ctWallToUtc(2026, 10, 18, 10, 0, 0);
    const next = ctWallToUtc(2026, 10, 19, 10, 0, 0);
    const previous = ctWallToUtc(2026, 10, 11, 10, 0, 0);
    expect(monday?.toISOString()).toBe("2026-10-12T15:00:00.000Z");
    const page = model(raw({
      posts: [
        post(monday!, "walton", "Monday"),
        post(sunday!, "walton", "Sunday"),
        post(next!, "walton", "Next"),
        post(previous!, "walton", "Previous"),
      ],
    }));
    expect(page.week.map((day) => day.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(page.week.map((day) => day.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("keeps the live feed to the latest 10 events", () => {
    const posts = Array.from({ length: 12 }, (_, index) =>
      post(new Date(NOW.getTime() - (index + 1) * 3_600_000), "walton", `Topic ${index}`),
    );
    const page = model(raw({ posts }));
    expect(page.feed).toHaveLength(10);
    expect(page.feed[0]?.text).toContain("Topic 0");
    expect(page.feed.some((item) => item.text.includes("Topic 11"))).toBe(false);
  });

  it("attributes GitHub work", () => {
    const map = parseRepoMap('{"scenic-bot":"Scout","guides":"Chief"}').map;
    expect(attributeBot({ repo: "savenello-web", title: "security patch", branch: "main", map: { "savenello-web": "Walton" } })).toBe("warden");
    expect(attributeBot({ repo: "guides", title: "ranking update", branch: "main", map: {} })).toBe("bob");
    expect(attributeBot({ repo: "guides", title: "Fix seo titles", branch: "main", map })).toBe("rank");
    expect(attributeBot({ repo: "Money-Notes", title: "Budget", branch: "main", map: {} })).toBe("money-man");
    expect(attributeBot({ repo: "scenic-bot", title: "Sketch", branch: "main", map })).toBe("scout");
    expect(attributeBot({ repo: "dashboard", title: "Add sprites", branch: "main", map: {} })).toBe("bob");
    expect(attributeBot({ repo: "dashboard", title: "Hello", branch: "warden/policy", map: {} })).toBe("warden");
    expect(attributeBot({ repo: "custom", title: "Hi", branch: "main", map: { custom: "Not A Bot" } })).toBe("bob");
    expect(parseRepoMap("[").error).toBeTruthy();
    expect(parseRepoMap("[]").error).toBeTruthy();
  });

  it("reads GraphQL and search payloads", () => {
    const map = {};
    const graphql = parseGraphqlBody(JSON.stringify({
      data: {
        user: {
          repositories: {
            nodes: [{
              name: "dashboard",
              pullRequests: { nodes: [{ title: "Add the pixel office", url: "https://github.com/marcongit850/dashboard/pull/1", mergedAt: "2026-10-14T18:00:00Z", createdAt: "2026-10-14T12:00:00Z", headRefName: "sprites" }] },
              openPullRequests: { nodes: [] },
              defaultBranchRef: {
                name: "main",
                target: { history: { nodes: [
                  { message: "Merge pull request #1 from sprites\n\nbody", committedDate: "2026-10-14T18:00:00Z", url: "https://github.com/marcongit850/dashboard/commit/aaa" },
                  { message: "Tidy the desk grid", committedDate: "2026-10-14T17:00:00Z", url: "https://github.com/marcongit850/dashboard/commit/bbb" },
                ] } },
              },
            }],
          },
        },
      },
    }), map);
    expect(graphql?.merged[0]?.botId).toBe("bob");
    expect(graphql?.commits.map((commit) => commit.message)).toEqual(["Tidy the desk grid"]);
    const search = parseSearchBody(JSON.stringify({
      items: [{ title: "Budget draft", html_url: "https://github.com/marcongit850/money-notes/pull/7", created_at: "2026-10-12T18:00:00Z" }],
    }), map);
    expect(search?.[0]?.botId).toBe("money-man");
    expect(search?.[0]?.repo).toBe("money-notes");
  });

  it("builds a stable demo office", () => {
    const page = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: false });
    expect(page.bots).toHaveLength(13);
    expect(page.feed).toHaveLength(10);
    expect(page.feed[0]?.text).toContain("Review the morning board");
    expect(page.week.map((day) => day.count)).toEqual([4, 6, 3, 0, 0, 0, 0]);
    expect(bot(page.bots, "chief").busy).toBe(true);
    expect(bot(page.bots, "tik-toker").busy).toBe(true);
    expect(bot(page.bots, "tik-toker").bubble).toBe("Cut the pier reel");
    expect(bot(page.bots, "bob").bubble).toBe("Add the pixel office");
    expect(bot(page.bots, "rank").bubble).toBe("Fix seo titles");
    expect(bot(page.bots, "walton").bubble).toBe("Beach flags are up");
    expect(bot(page.bots, "warden")).toMatchObject({ busy: false, attention: true, bubble: "", workingNow: "Waiting on a policy check" });
    expect(bot(page.bots, "money-man").attention).toBe(true);
    expect(bot(page.bots, "money-man").busy).toBe(false);
    for (const id of ["foody", "tango", "scout", "personal-assistant", "outreach"]) {
      expect(bot(page.bots, id).busy).toBe(false);
    }
    expect(page.needs.map((item) => item.title)).toEqual([
      "money-man is blocked and needs you",
      "Warden is blocked",
      "Budget draft",
    ]);
    expect(page.needs.some((item) => item.title === "Try a font")).toBe(false);
    expect(bot(page.bots, "bob").finishedLine).toContain("Lay out the sprite sheet");
    expect(bot(page.bots, "tik-toker").finishedLine).toBe("Nothing finished yet");
  });
});

describe("access config", () => {
  it("stays off until both values are set", () => {
    expect(accessMode("", "")).toBe("off");
    expect(accessMode("aud", "")).toBe("partial");
    expect(accessMode("", "https://team.cloudflareaccess.com")).toBe("partial");
    expect(accessMode("aud", "team.cloudflareaccess.com")).toBe("on");
  });

  it("normalizes the team issuer", () => {
    expect(teamIssuer("team.cloudflareaccess.com")).toBe("https://team.cloudflareaccess.com");
    expect(teamIssuer("https://team.cloudflareaccess.com/")).toBe("https://team.cloudflareaccess.com");
    expect(teamIssuer("http://team.cloudflareaccess.com")).toBeNull();
  });
});
