import { describe, expect, it } from "vitest";
import { accessMode, teamIssuer } from "../src/access";
import { CACHE_TTL_SECONDS } from "../src/cache";
import { buildDemoRaw } from "../src/demo";
import {
  attributeBot,
  githubAuthorization,
  graphqlProblem,
  parseGraphqlBody,
  parseRepoMap,
  parseRestCommits,
  parseRestPulls,
  parseRestRepoNames,
  parseSearchBody,
  restHistoryFromRepos,
} from "../src/github";
import { parsePostLog, parseStatus } from "../src/sheets";
import { buildModel, type BotCard } from "../src/state";
import { ctWallToUtc, DAY_MS, TWO_HOURS_MS } from "../src/time";
import type { Commit, Post, Pull, RawData, StatusRow } from "../src/types";

const NOW = new Date("2026-10-14T20:00:00.000Z");

function raw(partial: Partial<RawData> = {}): RawData {
  return { posts: [], statuses: [], pulls: [], commits: [], docs: [], notes: [], ...partial };
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

function commit(at: Date, botId: string, message: string): Commit {
  return { repo: "dashboard", message, url: "https://example.com/commit", at, branch: "main", botId };
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

  it("types only when the newest status is started or working and fresh", () => {
    const now = ctWallToUtc(2026, 10, 14, 12, 0, 0)!;
    const fresh = ctWallToUtc(2026, 10, 14, 11, 30, 0)!;
    const old = ctWallToUtc(2026, 10, 14, 9, 0, 0)!;
    const edge = new Date(now.getTime() - TWO_HOURS_MS);
    const past = new Date(now.getTime() - TWO_HOURS_MS - 1);

    const working = model(raw({
      statuses: [status(fresh, "chief", "working", "Write the board")],
    }), now);
    expect(bot(working.bots, "chief")).toMatchObject({ busy: true, bubble: "Write the board" });

    const staleStarted = model(raw({
      statuses: [status(old, "tik-toker", "started", "Cut the pier reel")],
    }), now);
    expect(bot(staleStarted.bots, "tik-toker")).toMatchObject({ busy: false, bubble: "" });

    expect(bot(model(raw({
      statuses: [status(edge, "bob", "started", "Still on time")],
    }), now).bots, "bob").busy).toBe(true);
    expect(bot(model(raw({
      statuses: [status(past, "bob", "started", "Too old")],
    }), now).bots, "bob").busy).toBe(false);

    const tied = ctWallToUtc(2026, 10, 14, 11, 0, 0)!;
    const laterWins = model(raw({
      statuses: [
        status(tied, "scout", "started", "First"),
        status(tied, "scout", "idle", "Second"),
      ],
    }), now);
    expect(bot(laterWins.bots, "scout").busy).toBe(false);

    const postOnly = model(raw({
      posts: [post(fresh, "walton", "Flags")],
      pulls: [pull(fresh, fresh, "bob", "Ship the desk")],
      commits: [commit(fresh, "rank", "Fix seo titles")],
    }), now);
    expect(bot(postOnly.bots, "walton")).toMatchObject({ busy: false, bubble: "" });
    expect(bot(postOnly.bots, "bob")).toMatchObject({ busy: false, bubble: "" });
    expect(bot(postOnly.bots, "rank")).toMatchObject({ busy: false, bubble: "" });
    expect(postOnly.feed.some((item) => item.text.includes("Flags"))).toBe(true);
    expect(postOnly.feed.some((item) => item.text.includes("Ship the desk"))).toBe(true);
  });

  it("does not type Walton after a finished row when a post is in the feed", () => {
    const statuses = parseStatus([
      "timestamp_ct,bot,state,task,link,needs_marc",
      "2026-10-13 16:00,Walton,started,Draft the recap,,no",
      "2026-10-14 10:26,Walton,finished,File the BCC notes,,no",
    ].join("\n")).rows;
    const posts = parsePostLog([
      "posted_at_ct,bot,site,platform,account,status,topic,post_url,reach,clicks,signups,notes",
      "2026-10-14 10:40,Walton,Walton County Updates,Facebook,,posted,BCC Oct 13 meeting recap (mirror),https://example.com/bcc,1,0,0,",
    ].join("\n")).posts;
    const now = ctWallToUtc(2026, 10, 14, 11, 10, 0)!;
    const page = model(raw({ statuses, posts }), now);
    const walton = bot(page.bots, "walton");
    expect(statuses[1]?.at.toISOString()).toBe("2026-10-14T15:26:00.000Z");
    expect(walton.busy).toBe(false);
    expect(walton.bubble).toBe("");
    expect(walton.workingNow).toBe("Idle");
    expect(walton.finishedLine).toContain("File the BCC notes");
    expect(page.feed.some((item) => item.text.includes("BCC Oct 13 meeting recap (mirror)"))).toBe(true);
    expect(walton.history.some((item) => item.text.includes("BCC Oct 13 meeting recap (mirror)"))).toBe(true);
    expect(walton.bubble).not.toContain("BCC Oct 13 meeting recap (mirror)");
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
    expect(bot(page.bots, "bob")).toMatchObject({ busy: false, bubble: "" });
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
    expect(githubAuthorization("ghp_exampletokenvalue000000000000")).toBe("Bearer ghp_exampletokenvalue000000000000");
    expect(githubAuthorization("Bearer ghp_exampletokenvalue000000000000")).toBe("Bearer ghp_exampletokenvalue000000000000");
    expect(githubAuthorization("token ghp_exampletokenvalue000000000000")).toBe("Bearer ghp_exampletokenvalue000000000000");
    expect(graphqlProblem(JSON.stringify({ errors: [{ message: "bad token ghp_exampletokenvalue000000000000" }] }))).not.toContain("ghp_");
    expect(parseRestRepoNames(JSON.stringify([{ name: "Dashboard" }, { name: "whatshappening" }]))).toEqual(["Dashboard", "whatshappening"]);
    const merged = parseRestPulls(JSON.stringify([
      { title: "Add the pixel office", html_url: "https://github.com/marcongit850/Dashboard/pull/1", created_at: "2026-10-14T12:00:00Z", merged_at: "2026-10-14T18:00:00Z", head: { ref: "sprites" } },
      { title: "Closed without merge", html_url: "https://github.com/marcongit850/Dashboard/pull/2", created_at: "2026-10-14T12:00:00Z", merged_at: null, head: { ref: "wip" } },
    ]), "Dashboard", {}, "merged");
    expect(merged?.map((item) => item.title)).toEqual(["Add the pixel office"]);
    const commits = parseRestCommits(JSON.stringify([
      { html_url: "https://github.com/marcongit850/Dashboard/commit/aaa", commit: { message: "Merge pull request #1\n\nbody", committer: { date: "2026-10-14T18:00:00Z" } } },
      { html_url: "https://github.com/marcongit850/Dashboard/commit/bbb", commit: { message: "Tidy the desk grid", committer: { date: "2026-10-14T17:00:00Z" } } },
    ]), "Dashboard", {});
    expect(commits?.map((item) => item.message)).toEqual(["Tidy the desk grid"]);
    const partial = restHistoryFromRepos([
      { name: "Dashboard", closed: JSON.stringify([{ title: "Add the pixel office", html_url: "https://github.com/marcongit850/Dashboard/pull/1", created_at: "2026-10-14T12:00:00Z", merged_at: "2026-10-14T18:00:00Z", head: { ref: "sprites" } }]), open: "[]", commits: "[]" },
      { name: "broken-repo", closed: null, open: null, commits: null },
    ], {});
    expect(partial.failedRepos).toEqual(["broken-repo"]);
    expect(partial.work?.merged.map((item) => item.title)).toEqual(["Add the pixel office"]);
    expect(restHistoryFromRepos([
      { name: "broken-repo", closed: null, open: null, commits: null },
    ], {}).work).toBeNull();
  });

  it("builds a stable demo office", () => {
    const page = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: false });
    expect(page.bots).toHaveLength(13);
    expect(page.feed).toHaveLength(10);
    expect(page.feed[0]?.text).toContain("Review the morning board");
    expect(page.week.map((day) => day.count)).toEqual([4, 6, 3, 0, 0, 0, 0]);
    expect(page.bots.filter((card) => card.busy).map((card) => card.id)).toEqual(["chief"]);
    expect(bot(page.bots, "chief").bubble).toBe("Review the morning board");
    expect(bot(page.bots, "tik-toker")).toMatchObject({ busy: false, bubble: "" });
    expect(bot(page.bots, "bob").bubble).toBe("");
    expect(bot(page.bots, "rank").bubble).toBe("");
    expect(bot(page.bots, "walton").bubble).toBe("");
    expect(page.feed.some((item) => item.text.includes("Beach flags are up"))).toBe(true);
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
