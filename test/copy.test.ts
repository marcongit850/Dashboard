import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COPY, postureLine } from "../src/copy";
import { buildDemoRaw } from "../src/demo";
import { renderBot, renderHome, renderMissing } from "../src/render";
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
    expect(html).toContain("Login not enabled yet");
    expect(html).toContain("Showing sample data.");
    expect(html).toContain(">Overview<");
    expect(html).toContain(">Posts<");
    expect(html).toContain(">Team<");
    expect(html).toContain("Live feed");
    expect(html).toContain("Posts this week");
    expect(html).toContain("Needs you");
    expect(html).toContain("Working now:");
    expect(html).toContain("Last finished:");
    expect(html).toContain('id="overview"');
    expect(html).toContain('id="posts"');
    expect(html).toContain('id="team"');
    expect(html.match(/class="desk /g)).toHaveLength(13);
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
    const signedIn = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: true });
    expect(renderHome(signedIn)).not.toContain("Login not enabled yet");
  });

  it("renders empty sources and a missing page", () => {
    const data: RawData = {
      posts: [],
      statuses: [],
      pulls: [],
      commits: [],
      notes: [COPY.postLogOff, COPY.savenelloOff, COPY.statusOff, COPY.githubOff],
    };
    const page = buildModel(data, NOW, { demo: false, loginEnabled: false });
    const html = renderHome(page);
    assertClean(html);
    expect(html).toContain(COPY.loginNotice);
    expect(html).toContain(COPY.noActivity);
    expect(html).toContain(COPY.noPosts);
    expect(html).toContain(COPY.nothingWaiting);
    expect(html).toContain(COPY.nothingFinished);
    expect(html).toContain(COPY.postLogOff);
    expect(html).toContain(COPY.githubOff);
    expect(html.match(/class="desk idle/g)).toHaveLength(13);
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
    expect(config).not.toMatch(/"routes"/);
    expect(config).not.toContain("GITHUB_TOKEN");
  });
});
