import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv";
import { countsAsPosted, parsePostLog, parseSavenello, parseStatus } from "../src/sheets";

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

  it("maps the post log and skips drafts", () => {
    const csv = [
      "posted_at_ct,bot,site,platform,account_or_group,status,topic,post_url,notes",
      '2026-10-14 12:00,Walton,"Walton County Updates",Facebook,Main,posted,"Beach, flags",https://example.com/a,Morning',
      "2026-10-14 13:00,Foody & Friends,Food Guides,Instagram,Main,draft,Hidden,https://example.com/b,",
      "2026-10-14 14:00,BOB THE BUILDER,Seaclusion,Web,Main,posted,Office tour,https://example.com/c,",
      "not-a-time,Rank,Guides,Web,Main,posted,Skip me,,",
    ].join("\n");
    const parsed = parsePostLog(csv, "Food Guides");
    expect(parsed.posts.map((post) => post.botId)).toEqual(["walton", "bob"]);
    expect(parsed.posts[0]?.topic).toBe("Beach, flags");
    expect(parsed.posts[0]?.at.toISOString()).toBe("2026-10-14T17:00:00.000Z");
    expect(parsed.posts[1]?.botId).toBe("bob");
    expect(parsed.notes.some((note) => note.includes("unreadable"))).toBe(true);
    expect(countsAsPosted("draft")).toBe(false);
    expect(countsAsPosted("")).toBe(true);
  });

  it("maps the Savenello organic columns onto Savenello Marketing", () => {
    const csv = [
      "Date,Channel/Platform,Account,Content type,Topic/Hook,Link,Status,Reach/Views,Clicks,Signups,Notes",
      "10/14/2026 1:00 PM,Instagram,@save,Reel,Morning light,https://example.com/s,posted,10,2,1,Nice",
      "10/14/2026 2:00 PM,Instagram,@save,Reel,Later,https://example.com/t,scheduled,1,0,0,",
    ].join("\n");
    const parsed = parseSavenello(csv);
    expect(parsed.posts).toHaveLength(1);
    expect(parsed.posts[0]?.botId).toBe("savenello-marketing");
    expect(parsed.posts[0]?.topic).toBe("Reel: Morning light");
    expect(parsed.posts[0]?.platform).toBe("Instagram");
    expect(parsed.posts[0]?.notes).toContain("Reach 10");
    expect(parsed.posts[0]?.notes).toContain("clicks 2");
    expect(parsed.posts[0]?.at.toISOString()).toBe("2026-10-14T18:00:00.000Z");
  });

  it("maps status rows, needs_marc, and Central Time in January", () => {
    const csv = [
      "timestamp_ct,bot,state,task,link,needs_marc",
      "2026-01-15 12:00,Chief,Started,Review,https://example.com/t,YES",
      "2026-01-15 13:00,warden,BLOCKED,Hold,,no",
      "2026-01-15 14:00,Nope,idle,Ghost,,y",
    ].join("\n");
    const parsed = parseStatus(csv);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({ botId: "chief", state: "started", needsMarc: true });
    expect(parsed.rows[0]?.at.toISOString()).toBe("2026-01-15T18:00:00.000Z");
    expect(parsed.rows[1]).toMatchObject({ botId: "warden", state: "blocked", needsMarc: false });
    expect(parsed.notes.some((note) => note.includes("Nope"))).toBe(true);
  });
});
