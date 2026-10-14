import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type CandyApi = {
  clamp: (value: number, min: number, max: number) => number;
  nearestIndex: (points: { x: number; y: number }[], radius: number) => number;
  shouldResumeWander: (lastInput: number, now: number, idleMs: number, keysHeld: boolean) => boolean;
  typingInField: (target: { tagName?: string; isContentEditable?: boolean } | null) => boolean;
  officeInView: (rect: { top: number; bottom: number } | null, viewHeight: number) => boolean;
};

function loadCandy(): { source: string; api: CandyApi } {
  const source = readFileSync("public/candy.js", "utf8");
  const start = source.indexOf("// pure:start");
  const end = source.indexOf("// pure:end");
  const pure = source.slice(start, end);
  const api = new Function(`${pure}\nreturn { clamp, nearestIndex, shouldResumeWander, typingInField, officeInView };`)() as CandyApi;
  return { source, api };
}

describe("candy visitor", () => {
  const { source, api } = loadCandy();

  it("keeps the visitor inside the room and picks the closest bot", () => {
    expect(api.clamp(120, 8, 92)).toBe(92);
    expect(api.clamp(-4, 8, 92)).toBe(8);
    expect(api.clamp(40, 8, 92)).toBe(40);
    expect(api.nearestIndex([], 150)).toBe(-1);
    expect(api.nearestIndex([{ x: 400, y: 0 }, { x: 40, y: 30 }], 150)).toBe(1);
    expect(api.nearestIndex([{ x: 200, y: 0 }, { x: 180, y: 20 }], 150)).toBe(-1);
    expect(api.nearestIndex([{ x: 150, y: 0 }], 150)).toBe(0);
  });

  it("returns to wandering after idle and ignores typing", () => {
    expect(api.shouldResumeWander(0, 10000, 10000, false)).toBe(true);
    expect(api.shouldResumeWander(0, 9999, 10000, false)).toBe(false);
    expect(api.shouldResumeWander(0, 20000, 10000, true)).toBe(false);
    expect(api.typingInField(null)).toBe(false);
    expect(api.typingInField({ tagName: "INPUT" })).toBe(true);
    expect(api.typingInField({ tagName: "TEXTAREA" })).toBe(true);
    expect(api.typingInField({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(api.typingInField({ tagName: "BODY" })).toBe(false);
    expect(api.officeInView({ top: 0, bottom: 800 }, 800)).toBe(true);
    expect(api.officeInView({ top: -760, bottom: 40 }, 800)).toBe(false);
    expect(api.officeInView(null, 800)).toBe(false);
  });

  it("ships transparent limb sprites and a script that does not fetch", () => {
    const parts = ["candy-torso", "candy-leg-l", "candy-leg-r", "candy-arm-l", "candy-arm-r"];
    for (const name of parts) {
      const png = readFileSync(`public/${name}.png`);
      const webp = readFileSync(`public/${name}.webp`);
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png[25]).toBe(6);
      expect(png.length).toBeLessThan(200_000);
      expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(webp.length).toBeLessThan(80_000);
    }
    const css = readFileSync("public/hq.css", "utf8");
    expect(css).toContain("leg-swing-l 0.4s");
    expect(css).toContain("translateY(-44px)");
    expect(css).toContain("candy-fade 1s");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain("Thanks!");
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("preventDefault");
    expect(source).toContain("10000");
    expect(source).toContain("startHandoff");
    expect(source).toContain("tossed-candy");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("XMLHttpRequest");
    expect(source).not.toContain("http-equiv");
  });
});
