import { matchBot } from "./bots";
import { missingColumn, unknownBot, unreadableTimes } from "./copy";
import { parseCsv } from "./csv";
import { clip } from "./html";
import { parseTimestamp } from "./time";
import type { Post, StatusRow, StatusState } from "./types";

const NOT_POSTED = new Set([
  "draft",
  "skipped",
  "cancelled",
  "canceled",
  "failed",
  "idea",
  "planned",
  "scheduled",
  "queued",
]);

export function countsAsPosted(status: string): boolean {
  const value = status.trim().toLowerCase();
  if (!value) return true;
  return !NOT_POSTED.has(value);
}

function table(csv: string): { headers: Map<string, number>; rows: string[][] } {
  const parsed = parseCsv(csv);
  const headers = new Map<string, number>();
  const headerRow = parsed[0] ?? [];
  headerRow.forEach((header, index) => {
    const key = header.trim().toLowerCase();
    if (key && !headers.has(key)) headers.set(key, index);
  });
  return { headers, rows: parsed.slice(1) };
}

function col(row: string[], headers: Map<string, number>, name: string): string {
  const index = headers.get(name);
  if (index == null) return "";
  return (row[index] ?? "").trim();
}

function blank(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

function metricNotes(row: string[], headers: Map<string, number>): string {
  const extra = [
    col(row, headers, "reach") ? `Reach ${col(row, headers, "reach")}` : "",
    col(row, headers, "clicks") ? `clicks ${col(row, headers, "clicks")}` : "",
    col(row, headers, "signups") ? `signups ${col(row, headers, "signups")}` : "",
    col(row, headers, "notes"),
  ].filter(Boolean);
  return clip(extra.join(", "));
}

export function parsePostLog(csv: string, source = "Posts"): { posts: Post[]; notes: string[] } {
  const notes: string[] = [];
  const { headers, rows } = table(csv);
  if (rows.length === 0 && headers.size === 0) return { posts: [], notes };
  if (!headers.has("posted_at_ct")) {
    return { posts: [], notes: [missingColumn(source, "posted_at_ct")] };
  }
  const posts: Post[] = [];
  const unknown = new Set<string>();
  let badTime = false;
  for (const row of rows) {
    if (blank(row)) continue;
    const status = col(row, headers, "status");
    if (!countsAsPosted(status)) continue;
    const at = parseTimestamp(col(row, headers, "posted_at_ct"));
    if (!at) {
      badTime = true;
      continue;
    }
    const botName = col(row, headers, "bot");
    const botId = matchBot(botName);
    if (!botId) {
      if (botName) unknown.add(botName);
      continue;
    }
    posts.push({
      at,
      botId,
      source,
      site: clip(col(row, headers, "site"), 120),
      platform: clip(col(row, headers, "platform"), 80),
      account: clip(col(row, headers, "account"), 120),
      status: clip(status, 40),
      topic: clip(col(row, headers, "topic")),
      url: col(row, headers, "post_url"),
      notes: metricNotes(row, headers),
    });
  }
  if (badTime) notes.push(unreadableTimes(source));
  for (const name of [...unknown].slice(0, 8)) notes.push(unknownBot(name, source));
  return { posts, notes };
}

function parseState(value: string): StatusState {
  const state = value.trim().toLowerCase();
  if (state === "started" || state === "finished" || state === "blocked" || state === "idle") return state;
  return "unknown";
}

function parseNeeds(value: string): boolean {
  const flag = value.trim().toLowerCase();
  return flag === "yes" || flag === "y" || flag === "true" || flag === "1";
}

export function parseStatus(csv: string, source = "Status sheet"): { rows: StatusRow[]; notes: string[] } {
  const notes: string[] = [];
  const { headers, rows } = table(csv);
  if (rows.length === 0 && headers.size === 0) return { rows: [], notes };
  if (!headers.has("timestamp_ct")) return { rows: [], notes: [missingColumn(source, "timestamp_ct")] };
  const parsed: StatusRow[] = [];
  const unknown = new Set<string>();
  let badTime = false;
  for (const row of rows) {
    if (blank(row)) continue;
    const at = parseTimestamp(col(row, headers, "timestamp_ct"));
    if (!at) {
      badTime = true;
      continue;
    }
    const botName = col(row, headers, "bot");
    const botId = matchBot(botName);
    if (!botId) {
      if (botName) unknown.add(botName);
      continue;
    }
    parsed.push({
      at,
      botId,
      state: parseState(col(row, headers, "state")),
      task: clip(col(row, headers, "task")),
      link: col(row, headers, "link"),
      needsMarc: parseNeeds(col(row, headers, "needs_marc")),
    });
  }
  if (badTime) notes.push(unreadableTimes(source));
  for (const name of [...unknown].slice(0, 8)) notes.push(unknownBot(name, source));
  return { rows: parsed, notes };
}
