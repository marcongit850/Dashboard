import { parseDocs } from "./docs";
import { attributeBot, parseRepoMap } from "./github";
import { addCalendarDays, ctWallParts, ctWallToUtc, startOfWeekCt } from "./time";
import type { Commit, Post, Pull, RawData, StatusRow, StatusState } from "./types";

const HOUR = 60 * 60 * 1000;

function ago(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * HOUR);
}

function onWeekday(now: Date, dayIndex: number, hour: number, minute: number): Date | null {
  const start = startOfWeekCt(now);
  const wall = ctWallParts(start);
  const day = addCalendarDays(wall.year, wall.month, wall.day, dayIndex);
  const stamp = ctWallToUtc(day.year, day.month, day.day, hour, minute, 0);
  if (!stamp || stamp.getTime() > now.getTime()) return null;
  return stamp;
}

function addPost(
  posts: Post[],
  at: Date | null,
  botId: string,
  site: string,
  platform: string,
  topic: string,
  url: string,
  notes = "",
) {
  if (!at) return;
  posts.push({
    at,
    botId,
    source: "Posts",
    site,
    platform,
    account: "",
    status: "posted",
    topic,
    url,
    notes,
  });
}

function status(at: Date, botId: string, state: StatusState, task: string, needsMarc: boolean, link = ""): StatusRow {
  return { at, botId, state, task, link, needsMarc };
}

export function buildDemoRaw(now: Date): RawData {
  const map = parseRepoMap('{"chief-desk":"Chief","outreach-list":"Outreach","scenic-bot":"Scout"}').map;
  const posts: Post[] = [];
  addPost(posts, onWeekday(now, 0, 9, 0), "walton", "Walton County Updates", "Facebook", "Pier opening hours", "https://example.com/posts/pier");
  addPost(posts, onWeekday(now, 0, 11, 0), "foody", "Food Guides", "Instagram", "Shrimp basket guide", "https://example.com/posts/shrimp");
  addPost(posts, onWeekday(now, 0, 15, 0), "tango", "Seaclusion", "Instagram", "Sunset from the dune", "https://example.com/posts/sunset");
  addPost(posts, onWeekday(now, 0, 18, 0), "savenello-marketing", "Savenello", "Instagram", "30A in one minute", "https://example.com/posts/minute");
  addPost(posts, onWeekday(now, 1, 9, 30), "walton", "Walton County Updates", "Facebook", "Rip current note", "https://example.com/posts/rip");
  addPost(posts, onWeekday(now, 1, 10, 30), "foody", "Food Guides", "Instagram", "Grouper sandwich", "https://example.com/posts/grouper");
  addPost(posts, onWeekday(now, 1, 12, 0), "tango", "Seaclusion", "TikTok", "Farmers market reel", "https://example.com/posts/market");
  addPost(posts, onWeekday(now, 1, 13, 30), "outreach", "Friends of Scenic 30A", "Email", "Newsletter subject lines", "https://example.com/posts/subjects");
  addPost(posts, onWeekday(now, 1, 15, 0), "savenello-marketing", "Savenello", "Instagram", "Cabin weeknight offer", "https://example.com/posts/cabin");
  addPost(posts, onWeekday(now, 1, 17, 0), "walton", "Walton County Updates", "Facebook", "Parking reminder", "https://example.com/posts/parking");
  addPost(posts, ago(now, 4), "outreach", "Friends of Scenic 30A", "Email", "Comment replies queued", "https://example.com/posts/replies");
  addPost(posts, ago(now, 1.2), "savenello-marketing", "Savenello", "Instagram", "Morning light on 30A", "https://example.com/posts/light", "Reach 840, clicks 22, signups 4");
  addPost(posts, ago(now, 0.6), "walton", "Walton County Updates", "Facebook", "Beach flags are up", "https://example.com/posts/flags", "Reach 120, clicks 6, signups 0");

  const statuses: StatusRow[] = [
    status(ago(now, 50), "chief", "finished", "Ship the Monday note", false, "https://example.com/status/monday"),
    status(ago(now, 0.4), "chief", "started", "Review the morning board", false, "https://example.com/status/board"),
    status(ago(now, 26), "bob", "finished", "Lay out the sprite sheet", false, "https://example.com/status/sprites"),
    status(ago(now, 96), "money-man", "finished", "Close the September sheet", false),
    status(ago(now, 3), "money-man", "blocked", "Approve the budget note", true, "https://example.com/status/budget"),
    status(ago(now, 30), "foody", "finished", "Publish the Friday guide", false),
    status(ago(now, 20), "tango", "finished", "Queue the weekend photos", false),
    status(ago(now, 6), "tik-toker", "started", "Cut the pier reel", false),
    status(ago(now, 72), "outreach", "finished", "Send the partner list", false),
    status(ago(now, 15), "scout", "finished", "Map the new trail accounts", false),
    status(ago(now, 5), "warden", "blocked", "Waiting on a policy check", false, "https://example.com/status/policy"),
    status(ago(now, 28), "personal-assistant", "finished", "File the receipts", false),
  ];

  function pull(repo: string, title: string, branch: string, url: string, createdHours: number, mergedHours: number | null): Pull {
    return {
      repo,
      title,
      branch,
      url,
      createdAt: ago(now, createdHours),
      mergedAt: mergedHours == null ? null : ago(now, mergedHours),
      botId: attributeBot({ repo, title, branch, map }),
    };
  }

  const pulls: Pull[] = [
    pull("dashboard", "Add the pixel office", "sprites", "https://github.com/marcongit850/dashboard/pull/12", 6, 0.7),
    pull("dashboard", "Wire the desk grid", "grid", "https://github.com/marcongit850/dashboard/pull/9", 80, 72),
    pull("guides", "Fix seo titles", "meta", "https://github.com/marcongit850/guides/pull/4", 8, 0.9),
    pull("dashboard", "Tighten security headers", "main", "https://github.com/marcongit850/dashboard/pull/11", 20, 5),
    pull("savenello-web", "Update the landing page", "copy", "https://github.com/marcongit850/savenello-web/pull/18", 40, 30),
    pull("chief-desk", "Note the overnight changes", "main", "https://github.com/marcongit850/chief-desk/pull/3", 48, 40),
    pull("money-notes", "Budget draft", "budget", "https://github.com/marcongit850/money-notes/pull/7", 50, null),
    pull("dashboard", "Try a font", "font", "https://github.com/marcongit850/dashboard/pull/13", 3, null),
  ];

  function commit(repo: string, message: string, branch: string, url: string, hours: number): Commit {
    return {
      repo,
      message,
      branch,
      url,
      at: ago(now, hours),
      botId: attributeBot({ repo, title: message, branch, map }),
    };
  }

  const commits: Commit[] = [
    commit("dashboard", "Tidy the desk grid", "sprites", "https://github.com/marcongit850/dashboard/commit/abc", 2.5),
    commit("outreach-list", "Refresh the contact sheet", "main", "https://github.com/marcongit850/outreach-list/commit/def", 8),
    commit("scenic-bot", "Sketch the overlook list", "main", "https://github.com/marcongit850/scenic-bot/commit/ghi", 18),
    commit("money-ledger", "Reconcile the week", "main", "https://github.com/marcongit850/money-ledger/commit/jkl", 10),
  ];

  const docs = parseDocs(
    [
      "Name,Link,What it is,Owner bot",
      "Team handbooks folder,https://drive.google.com/drive/folders/team-handbooks,Every bot handbook,Chief",
      "Morning board,https://docs.google.com/document/d/morning,What the team is doing today,Chief",
      "Bob handbook,https://docs.google.com/document/d/bob-handbook,How Bob builds the office,Bob The Builder",
      "Desk notes,https://docs.google.com/document/d/bob-notes,Layout notes for the room,Bob",
      "Budget sheet,https://docs.google.com/spreadsheets/d/budget,Spend and invoices,money-man",
      "Beach guide,http://docs.google.com/document/d/beach,Flags and parking,Walton",
      "DELETE old board,https://docs.google.com/document/d/old,Retired,Chief",
      "Public site,https://example.com/not-google,Not a Google doc,Walton",
      "Token dump,https://docs.google.com/document/d/token,ghp_abcdefghijklmnopqrstuvwxyz1234567890,Warden",
      "Secret name,https://docs.google.com/document/d/hidden,Should not show,ghp_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
      "Vendor list,https://drive.google.com/drive/folders/vendors,Outside contacts,Scenic Friends",
    ].join("\n"),
  ).docs;

  return { posts, statuses, pulls, commits, docs, notes: [] };
}
