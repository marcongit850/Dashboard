import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv";
import { countsAsPosted, parsePostLog, parseStatus } from "../src/sheets";

describe("CSV parsing", () => {
  it("parses quotes, escaped quotes, commas, and CRLF", () => {
    const rows = parseCsv('a,b\r\n"hello, world","he said ""hi"""\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["hello, world", 'he said "hi"'],
    ]);
  });

  it("keeps newlines inside quotes and strips a BOM", () => {
    const rows = parseCsv('\uFEFFtopic,notes\n"Beach, flags","line one\nline two"\n');
    expect(rows[0]).toEqual(["topic", "notes"]);
    expect(rows[1]?.[0]).toBe("Beach, flags");
    expect(rows[1]?.[1]).toBe("line one\nline two");
  });

  it("does not throw on an unterminated quote", () => {
    expect(() => parseCsv('a,b\n1,"unterminated')).not.toThrow();
  });

  it("maps the posts tab, the bot column, and skips drafts", () => {
    const csv = [
      "posted_at_ct,bot,site,platform,account,status,topic,post_url,reach,clicks,signups,notes",
      '2026-10-14 12:00,Walton,"Walton County Updates",Facebook,Main,posted,"Beach, flags",https://example.com/a,120,6,0,Morning',
      "2026-10-14 13:00,Foody & Friends,Food Guides,Instagram,Main,draft,Hidden,https://example.com/b,,,,",
      "2026-10-14 14:00,BOB THE BUILDER,Seaclusion,Web,Main,posted,Office tour,https://example.com/c,,,,",
      "not-a-time,Rank,Guides,Web,Main,posted,Skip me,,,,,,,",
      "10/14/2026 1:00 PM,Savenello Marketing,Savenello,Instagram,@save,posted,Morning light,https://example.com/s,10,2,1,Nice",
      "10/14/2026 2:00 PM,Savenello Marketing,Savenello,Instagram,@save,scheduled,Later,https://example.com/t,1,0,0,",
    ].join("\n");
    const parsed = parsePostLog(csv);
    expect(parsed.posts.map((post) => post.botId)).toEqual(["walton", "bob", "savenello-marketing"]);
    expect(parsed.posts[0]).toMatchObject({
      topic: "Beach, flags",
      site: "Walton County Updates",
      account: "Main",
      source: "Posts",
    });
    expect(parsed.posts[0]?.notes).toBe("Reach 120, clicks 6, signups 0, Morning");
    expect(parsed.posts[0]?.at.toISOString()).toBe("2026-10-14T17:00:00.000Z");
    expect(parsed.posts[2]).toMatchObject({
      botId: "savenello-marketing",
      platform: "Instagram",
      topic: "Morning light",
    });
    expect(parsed.posts[2]?.notes).toContain("Reach 10");
    expect(parsed.posts[2]?.notes).toContain("clicks 2");
    expect(parsed.posts[2]?.notes).toContain("signups 1");
    expect(parsed.posts[2]?.at.toISOString()).toBe("2026-10-14T18:00:00.000Z");
    expect(parsed.notes.some((note) => note.includes("unreadable"))).toBe(true);
    expect(countsAsPosted("draft")).toBe(false);
    expect(countsAsPosted("scheduled")).toBe(false);
    expect(countsAsPosted("")).toBe(true);
  });

  it("maps status rows, needs_marc, and Central Time in January", () => {
    const csv = [
      "timestamp_ct,bot,state,task,link,needs_marc",
      "2026-01-15 12:00,Chief,Started,Review,https://example.com/t,YES",
      "2026-10-14 09:15 CT,money-man,blocked,Budget check,,yes",
      "2026-01-15 13:00,warden,BLOCKED,Hold,,no",
      "2026-01-15 14:00,Nope,idle,Ghost,,y",
      "2026-10-14 10:00,Walton,working,Draft the recap,,no",
      "2026-10-14 10:26,Walton,done,File the BCC notes,,no",
    ].join("\n");
    const parsed = parseStatus(csv);
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.rows[0]).toMatchObject({ botId: "chief", state: "started", needsMarc: true });
    expect(parsed.rows[0]?.at.toISOString()).toBe("2026-01-15T18:00:00.000Z");
    expect(parsed.rows[1]).toMatchObject({ botId: "money-man", state: "blocked", needsMarc: true });
    expect(parsed.rows[1]?.at.toISOString()).toBe("2026-10-14T14:15:00.000Z");
    expect(parsed.rows[2]).toMatchObject({ botId: "warden", state: "blocked", needsMarc: false });
    expect(parsed.rows[3]).toMatchObject({ botId: "walton", state: "working" });
    expect(parsed.rows[4]).toMatchObject({ botId: "walton", state: "finished", task: "File the BCC notes" });
    expect(parsed.notes.some((note) => note.includes("Nope"))).toBe(true);
  });
});
