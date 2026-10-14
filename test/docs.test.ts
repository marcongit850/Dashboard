import { describe, expect, it } from "vitest";
import { buildDemoRaw } from "../src/demo";
import { docUrl, groupDocs, handbookFor, looksLikeSecret, otherDocsFor, parseDocs } from "../src/docs";
import { sameConfiguredGid } from "../src/http";
import { buildModel } from "../src/state";
import { renderBot } from "../src/render";

const NOW = new Date("2026-10-14T20:00:00.000Z");

const CSV = [
  "Name,Link,What it is,Owner bot",
  "Team handbooks folder,https://drive.google.com/drive/folders/team-handbooks,Every bot handbook,Chief",
  "Bob handbook,https://docs.google.com/document/d/bob-handbook,How Bob builds the office,Bob The Builder",
  "Desk notes,https://docs.google.com/document/d/bob-notes,Layout notes for the room,Bob",
  "DELETE old board,https://docs.google.com/document/d/old,Retired,Chief",
  "Public site,https://example.com/not-google,Not a Google doc,Walton",
  "Sneaky host,https://docs.google.com.evil.com/document/d/x,Wrong host,Walton",
  "Signed in link,https://user:pass@docs.google.com/document/d/creds,Has a password,Chief",
  "Token in query,https://docs.google.com/document/d/q?token=ghp_abcdefghijklmnopqrstuvwxyz1234567890,Query secret,Chief",
  "Token dump,https://docs.google.com/document/d/token,ghp_abcdefghijklmnopqrstuvwxyz1234567890,Warden",
  "Secret name,https://docs.google.com/document/d/hidden,Should not show,ghp_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
  "Beach guide,http://docs.google.com/document/d/beach,Flags and parking,Walton",
  "Vendor list,https://drive.google.com/drive/folders/vendors,Outside contacts,Scenic Friends",
  "Budget sheet,https://docs.google.com/spreadsheets/d/budget,Spend and invoices,money-man",
].join("\n");

describe("docs inventory", () => {
  it("refuses a redirect onto a different sheet gid", () => {
    const docs = "https://docs.google.com/spreadsheets/d/e/PUB/pub?single=true&output=csv&gid=1034259486";
    const kept = "https://doc-0c-3k-sheets.googleusercontent.com/pub/abc/e@PUB?single=true&output=csv&gid=1034259486";
    const other = "https://docs.google.com/spreadsheets/d/e/PUB/pub?single=true&output=csv&gid=0";
    expect(sameConfiguredGid(docs, kept)).toBe(true);
    expect(sameConfiguredGid(docs, other)).toBe(false);
    expect(sameConfiguredGid(docs, "https://docs.google.com/spreadsheets/d/e/PUB/pub?output=csv")).toBe(false);
  });

  it("keeps Google doc links and drops deletes, other hosts, and secrets", () => {
    expect(looksLikeSecret("ghp_abcdefghijklmnopqrstuvwxyz1234567890")).toBe(true);
    expect(looksLikeSecret("How Bob builds the office")).toBe(false);
    expect(docUrl("https://docs.google.com/document/d/abc")).toBe("https://docs.google.com/document/d/abc");
    expect(docUrl("http://drive.google.com/drive/folders/abc")).toContain("drive.google.com");
    expect(docUrl("https://example.com/docs")).toBe("");
    expect(docUrl("https://docs.google.com.evil.com/document/d/x")).toBe("");
    expect(docUrl("https://user:pass@docs.google.com/document/d/creds")).toBe("");

    const parsed = parseDocs(CSV);
    const names = parsed.docs.map((doc) => doc.name);
    expect(names).toEqual([
      "Team handbooks folder",
      "Bob handbook",
      "Desk notes",
      "Token dump",
      "Beach guide",
      "Vendor list",
      "Budget sheet",
    ]);
    expect(parsed.docs.find((doc) => doc.name === "Token dump")?.about).toBe("");
    expect(JSON.stringify(parsed.docs)).not.toContain("ghp_");
    expect(parsed.docs.find((doc) => doc.name === "Beach guide")?.url.startsWith("http://")).toBe(true);

    const labels = groupDocs(parsed.docs).map((group) => group.label);
    expect(labels).toEqual(["Chief", "Bob", "money-man", "Walton", "Warden", "Scenic Friends"]);
  });

  it("uses the bot handbook, then the team folder", () => {
    const docs = parseDocs(CSV).docs;
    expect(handbookFor(docs, "bob")?.name).toBe("Bob handbook");
    expect(otherDocsFor(docs, "bob", handbookFor(docs, "bob")).map((doc) => doc.name)).toEqual(["Desk notes"]);
    expect(handbookFor(docs, "tango")?.name).toBe("Team handbooks folder");
    expect(otherDocsFor(docs, "tango", handbookFor(docs, "tango"))).toEqual([]);
    expect(handbookFor(docs, "chief")?.name).toBe("Team handbooks folder");
  });

  it("notes a missing name column and renders the tango fallback", () => {
    const parsed = parseDocs("Link,Owner bot\nhttps://docs.google.com/document/d/a,Bob");
    expect(parsed.docs).toEqual([]);
    expect(parsed.notes[0]).toContain("Name");

    const page = buildModel(buildDemoRaw(NOW), NOW, { demo: true, loginEnabled: true });
    const tango = page.bots.find((card) => card.slug === "tango");
    if (!tango) throw new Error("missing tango");
    const html = renderBot(page, tango);
    expect(html).toContain("Handbook");
    expect(html).toContain("Team handbooks folder");
    expect(html).toContain("https://drive.google.com/drive/folders/team-handbooks");
    expect(html).toContain("No other docs yet.");
  });
});