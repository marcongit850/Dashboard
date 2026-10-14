import { describe, expect, it } from "vitest";
import { BOTS } from "../src/bots";
import { COPY } from "../src/copy";
import { escapeHtml } from "../src/html";
import { buildDemoRaw } from "../src/demo";
import { JOBS } from "../src/jobs";
import { renderBot, renderHome } from "../src/render";
import { buildModel } from "../src/state";

const NOW = new Date("2026-10-14T20:00:00.000Z");
const BAD = /[\u2013\u2014]/;

describe("job responsibilities", () => {
  it("keeps one short plain description for every bot", () => {
    expect(Object.keys(JOBS).sort()).toEqual(BOTS.map((bot) => bot.id).sort());
    for (const sentences of Object.values(JOBS)) {
      expect(sentences.length).toBeGreaterThanOrEqual(2);
      expect(sentences.length).toBeLessThanOrEqual(4);
      for (const sentence of sentences) {
        expect(sentence.endsWith(".")).toBe(true);
        expect(sentence.match(BAD)).toBeNull();
      }
    }
  });

  it("links every office character to a bot page that shows the job", () => {
    const page = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: true, basePath: "/dash" });
    const home = renderHome(page);
    for (const bot of BOTS) {
      expect(home).toContain(`href="/dash/bot/${bot.slug}?demo=1"`);
      const card = page.bots.find((item) => item.id === bot.id);
      if (!card) throw new Error(bot.id);
      const html = renderBot(page, card);
      expect(html).toContain(COPY.jobResponsibilities);
      for (const sentence of JOBS[bot.id] ?? []) expect(html).toContain(escapeHtml(sentence));
    }
    const bob = page.bots.find((item) => item.id === "bob");
    if (!bob) throw new Error("bob");
    expect(renderBot(page, bob)).toContain("Tang-O-Mar HOA portal");
    expect(renderBot(page, bob)).toContain("this dashboard");
  });
});