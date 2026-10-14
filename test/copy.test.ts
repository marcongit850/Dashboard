import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COPY, postureLine } from "../src/copy";
import { buildDemoRaw } from "../src/demo";
import { renderBot, renderDocs, renderHome, renderMissing } from "../src/render";
import { buildModel } from "../src/state";
import type { RawData } from "../src/types";

const NOW = new Date("2026-10-14T20:00:00.000Z");
const BAD = /[\u2013\u2014]|&mdash;|&ndash;|&#8211;|&#8212;|&#x2013;|&#x2014;/i;

function assertClean(value: string) {
  expect(value.match(BAD)).toBeNull();
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

describe("dash-free copy", () => {
  it("keeps static copy free of em and en dashes", () => {
    for (const value of Object.values(COPY)) assertClean(value);
    for (const busy of [false, true]) {
      for (const blocked of [false, true]) {
        for (const needs of [false, true]) assertClean(postureLine(busy, blocked, needs));
      }
    }
  });

  it("keeps source, styles, and docs free of em and en dashes", () => {
    const files = [
      ...walk("src"),
      ...walk("public"),
      "README.md",
      "ARCHITECTURE.md",
      "wrangler.jsonc",
    ];
    for (const file of files) assertClean(readFileSync(file, "utf8"));
  });

  it("renders the demo office without scripts or refresh", () => {
    const page = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: false });
    const html = renderHome(page);
    assertClean(html);
    expect(html).toContain("Team HQ");
    expect(html).toContain("Cloudflare Access is not enabled yet");
    expect(html).toContain("Showing sample data.");
    expect(html).toContain(">Overview<");
    expect(html).toContain(">Posts<");
    expect(html).toContain(">Team<");
    expect(html).toContain(">Docs<");
    expect(html).toContain('href="/docs?demo=1"');
    expect(html).toContain("Live feed");
    expect(html).toContain("Posts this week");
    expect(html).toContain("Needs you");
    expect(html).toContain("Working now:");
    expect(html).toContain("Last finished:");
    expect(html).toContain('id="overview"');
    expect(html).toContain('id="posts"');
    expect(html).toContain('id="team"');
    expect(html.match(/class="seat /g)).toHaveLength(13);
    expect(html).toContain("at-12");
    expect(html).not.toContain("style=\"--x");
    for (const name of ["Chief", "Bob", "Outreach", "Walton", "Tik-Toker", "Rank", "Warden", "Scout", "Foody", "Savenello Marketing", "Personal Assistant", "money-man", "Tango"]) {
      expect(html).toContain(name);
    }
    expect(html).toContain('class="office"');
    expect(html).not.toContain('class="pixel"');
    expect(html).toContain('href="/bot/chief?demo=1"');
    expect(html).toContain(COPY.officeHint);
    expect(html).toContain('class="bang"');
    expect(html).toContain("Beach flags are up");
    expect(html).toContain("Budget draft");
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html.toLowerCase()).not.toContain("http-equiv=\"refresh\"");
    expect(html).not.toContain("setInterval");
    expect(html).not.toContain("setTimeout");
    const bob = page.bots.find((card) => card.slug === "bob");
    const warden = page.bots.find((card) => card.slug === "warden");
    const money = page.bots.find((card) => card.slug === "money-man");
    if (!bob || !warden || !money) throw new Error("missing demo bots");
    for (const card of [bob, warden, money]) {
      const botHtml = renderBot(page, card);
      assertClean(botHtml);
      expect(botHtml).toContain("History");
      expect(botHtml).toContain("Reports");
      expect(botHtml).toContain(card.statusLine);
    }
    expect(renderBot(page, bob)).toContain("Add the pixel office");
    expect(renderBot(page, bob)).toContain("Lay out the sprite sheet");
    expect(renderBot(page, bob)).toContain("Bob handbook");
    expect(renderBot(page, bob)).toContain("https://docs.google.com/document/d/bob-handbook");
    expect(renderBot(page, bob)).not.toContain("ghp_");
    const docsPage = renderDocs(page);
    assertClean(docsPage);
    expect(docsPage).toContain("Team handbooks folder");
    expect(docsPage).toContain("Scenic Friends");
    expect(docsPage).not.toContain("DELETE");
    expect(docsPage).not.toContain("example.com");
    expect(docsPage).not.toContain("ghp_");
    const signedIn = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: true });
    expect(renderHome(signedIn)).not.toContain("Cloudflare Access is not enabled yet");
    const gated = buildModel(buildDemoRaw(NOW), NOW, { demo: false, loginEnabled: false, passwordGate: true });
    expect(renderHome(gated)).not.toContain("Cloudflare Access is not enabled yet");
  });

  it("renders empty sources and a missing page", () => {
    const data: RawData = {
      posts: [],
      statuses: [],
      pulls: [],
      commits: [],
      docs: [],
      notes: [COPY.postsOff, COPY.statusOff, COPY.docsOff, COPY.githubOff],
    };
    const page = buildModel(data, NOW, { demo: false, loginEnabled: false });
    const html = renderHome(page);
    assertClean(html);
    expect(html).toContain(COPY.loginNotice);
    expect(html).toContain(COPY.noActivity);
    expect(html).toContain(COPY.noPosts);
    expect(html).toContain(COPY.nothingWaiting);
    expect(html).toContain(COPY.nothingFinished);
    expect(html).toContain(COPY.postsOff);
    expect(html).toContain(COPY.docsOff);
    const docsPage = renderDocs(page);
    assertClean(docsPage);
    expect(docsPage).toContain(COPY.docsOff);
    expect(html).toContain(COPY.githubOff);
    expect(html.match(/class="seat idle/g)).toHaveLength(13);
    const missing = renderMissing(page, true);
    assertClean(missing);
    expect(missing).toContain(COPY.noBot);
  });

  it("does not schedule the worker", () => {
    const config = readFileSync("wrangler.jsonc", "utf8");
    expect(config).toContain('"name": "dashboard"');
    expect(config).toContain('"workers_dev": true');
    expect(config).toContain("f1c59948520f1ec39473238b621c7e24");
    expect(config).not.toMatch(/"crons"/);
    expect(config).not.toMatch(/"triggers"/);
    expect(config).not.toMatch(/custom_domain/);
    expect(config).toContain('"routes"');
    expect(config).toContain("whatshappeningnetwork.com/dash");
    expect(config).toContain("whatshappeningnetwork.com/dash/*");
    expect(config).not.toMatch(/dash\*/);
    expect(config).toContain('"BASE_PATH": "/dash"');
    expect(config).toContain('"binding": "DISMISSALS"');
    expect(config).toContain("1e0c1227633e4277b77ec6d0245641ec");
    expect(config).not.toContain("GITHUB_TOKEN");
    expect(config).not.toContain("DASH_PASSWORD");
    expect(config).not.toContain("DASH_COOKIE_SECRET");
    expect(config).toContain('"POSTS_CSV_URL"');
    expect(config).toContain('"STATUS_CSV_URL"');
    expect(config).toContain('"DOCS_CSV_URL"');
    expect(config).not.toContain("POSTLOG_CSV_URLS");
    expect(config).not.toContain("SAVENELLO_CSV_URL");
  });
});
