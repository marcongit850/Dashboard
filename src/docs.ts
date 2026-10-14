import { BOTS, botById, matchBot } from "./bots";
import { missingColumn } from "./copy";
import { parseCsv } from "./csv";
import { clip } from "./html";
import type { DocLink } from "./types";

export type { DocLink };

export type DocGroup = {
  id: string | null;
  label: string;
  docs: DocLink[];
};

const DOC_HOSTS = new Set(["docs.google.com", "drive.google.com"]);
const TEAM_FOLDER = "team handbooks folder";
const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_|gho_|ghu_|ghs_|github_pat_|sk_live_|sk_test_|sk-|rk_live_|xox[baprs]-|AKIA[0-9A-Z]{12,}|AIza[0-9A-Za-z_-]{20,}|glpat-|npm_[A-Za-z0-9]{20,}|ya29\.|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.)|\b(?:api[_-]?key|apikey|secret|password|passwd|token|bearer)\b\s*[:=]\s*\S{6,}/i;
const LONG_HEX = /(?:^|[^a-z0-9])[a-f0-9]{40,}(?:[^a-z0-9]|$)/i;

export function looksLikeSecret(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (SECRET.test(text)) return true;
  if (LONG_HEX.test(text) && !/^https?:\/\//i.test(text)) return true;
  return false;
}

export function docUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || looksLikeSecret(trimmed)) return "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.username || url.password) return "";
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  if (!DOC_HOSTS.has(url.hostname.toLowerCase())) return "";
  for (const part of url.searchParams.values()) {
    if (looksLikeSecret(part)) return "";
  }
  return url.toString();
}

function headersOf(row: string[]): Map<string, number> {
  const headers = new Map<string, number>();
  row.forEach((header, index) => {
    const key = header.trim().toLowerCase();
    if (key && !headers.has(key)) headers.set(key, index);
  });
  return headers;
}

function cell(row: string[], headers: Map<string, number>, name: string): string {
  const index = headers.get(name);
  if (index == null) return "";
  return (row[index] ?? "").trim();
}

export function isTeamFolder(name: string): boolean {
  return name.toLowerCase().includes(TEAM_FOLDER);
}

export function isHandbookName(name: string): boolean {
  return name.toLowerCase().includes("handbook") && !isTeamFolder(name);
}

export function parseDocs(csv: string, source = "Docs sheet"): { docs: DocLink[]; notes: string[] } {
  const notes: string[] = [];
  const parsed = parseCsv(csv);
  const headers = headersOf(parsed[0] ?? []);
  const rows = parsed.slice(1);
  if (rows.length === 0 && headers.size === 0) return { docs: [], notes };
  if (!headers.has("name")) return { docs: [], notes: [missingColumn(source, "Name")] };
  if (!headers.has("link")) return { docs: [], notes: [missingColumn(source, "Link")] };
  const docs: DocLink[] = [];
  for (const row of rows) {
    if (row.every((item) => item.trim() === "")) continue;
    const name = clip(cell(row, headers, "name"));
    if (!name || name.toLowerCase().includes("delete")) continue;
    if (looksLikeSecret(name)) continue;
    const url = docUrl(cell(row, headers, "link"));
    if (!url) continue;
    const ownerRaw = cell(row, headers, "owner bot");
    if (looksLikeSecret(ownerRaw)) continue;
    const aboutRaw = cell(row, headers, "what it is");
    const about = looksLikeSecret(aboutRaw) ? "" : clip(aboutRaw);
    const ownerId = matchBot(ownerRaw);
    const owner = ownerId ? botById(ownerId) : undefined;
    docs.push({
      name,
      url,
      about,
      ownerId,
      ownerLabel: owner?.display ?? (ownerRaw ? clip(ownerRaw, 80) : "Shared"),
    });
  }
  return { docs, notes };
}

export function groupDocs(docs: DocLink[]): DocGroup[] {
  const buckets = new Map<string, DocGroup>();
  for (const doc of docs) {
    const key = doc.ownerId ?? `other:${doc.ownerLabel.toLowerCase()}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.docs.push(doc);
      continue;
    }
    buckets.set(key, { id: doc.ownerId, label: doc.ownerLabel, docs: [doc] });
  }
  const roster = new Map(BOTS.map((bot, index) => [bot.id, index]));
  return [...buckets.values()].sort((a, b) => {
    const ai = a.id ? roster.get(a.id) : undefined;
    const bi = b.id ? roster.get(b.id) : undefined;
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.label.localeCompare(b.label);
  });
}

export function handbookFor(docs: DocLink[], botId: string): DocLink | null {
  return (
    docs.find((doc) => doc.ownerId === botId && isHandbookName(doc.name)) ??
    docs.find((doc) => isTeamFolder(doc.name)) ??
    null
  );
}

export function otherDocsFor(docs: DocLink[], botId: string, handbook: DocLink | null): DocLink[] {
  return docs.filter((doc) => doc.ownerId === botId && doc !== handbook);
}
