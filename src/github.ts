import { matchBot } from "./bots";
import { clip } from "./html";
import { parseTimestamp } from "./time";
import type { Commit, Pull } from "./types";

export const GITHUB_OWNER = "marcongit850";

export const GITHUB_QUERY = `query TeamHq($login: String!) {
  user(login: $login) {
    repositories(first: 12, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes {
        name
        pullRequests(first: 5, states: MERGED, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes { title url mergedAt createdAt headRefName }
        }
        openPullRequests: pullRequests(first: 8, states: OPEN, orderBy: {field: CREATED_AT, direction: ASC}) {
          nodes { title url createdAt headRefName }
        }
        defaultBranchRef {
          name
          target {
            ... on Commit {
              history(first: 3) {
                nodes { message committedDate url }
              }
            }
          }
        }
      }
    }
  }
}`;

export function repoShort(repo: string): string {
  const parts = repo.trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

function hasWord(text: string, words: string[]): boolean {
  const hay = text.toLowerCase();
  return words.some((word) => new RegExp(`(?:^|[^a-z0-9])${word}(?:[^a-z0-9]|$)`).test(hay));
}

export function parseRepoMap(raw: string): { map: Record<string, string>; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { map: {}, error: null };
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { map: {}, error: "BOT_REPO_MAP must be a JSON object." };
    }
    const map: Record<string, string> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && key.trim()) map[key.trim().toLowerCase()] = item.trim();
    }
    return { map, error: null };
  } catch {
    return { map: {}, error: "BOT_REPO_MAP is not valid JSON." };
  }
}

export function attributeBot(input: { repo: string; title: string; branch: string; map: Record<string, string> }): string {
  const signal = `${input.title} ${input.branch}`;
  if (hasWord(signal, ["security", "warden"])) return "warden";
  if (hasWord(signal, ["seo", "rank"])) return "rank";
  const short = repoShort(input.repo);
  const full = input.repo.trim().toLowerCase();
  const mapped = input.map[short] ?? input.map[full];
  if (mapped) {
    const id = matchBot(mapped);
    if (id) return id;
  }
  if (/^(savenello|money)/i.test(short)) return "money-man";
  return "bob";
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nodes(value: unknown): Record<string, unknown>[] {
  const box = record(value);
  const list = box?.nodes;
  if (!Array.isArray(list)) return [];
  return list.map(record).filter((item): item is Record<string, unknown> => item !== null);
}

function subject(message: string): string {
  const line = clip(message.split(/\r?\n/, 1)[0] ?? "", 180);
  if (!line || /^merge (pull request|branch)\b/i.test(line)) return "";
  return line;
}

function repoFromUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[1] ?? "";
  } catch {
    return "";
  }
}

export type GithubWork = { merged: Pull[]; open: Pull[]; commits: Commit[] };

export function parseGraphqlBody(body: string, map: Record<string, string>): GithubWork | null {
  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    return null;
  }
  const user = record(record(record(json)?.data)?.user);
  if (!user) return null;
  const repos = nodes(user.repositories);
  const merged: Pull[] = [];
  const open: Pull[] = [];
  const commits: Commit[] = [];
  for (const repo of repos) {
    const name = text(repo.name);
    if (!name) continue;
    for (const pull of nodes(repo.pullRequests)) {
      const title = clip(text(pull.title), 180);
      const url = text(pull.url);
      const mergedAt = parseTimestamp(text(pull.mergedAt));
      const createdAt = parseTimestamp(text(pull.createdAt)) ?? mergedAt;
      if (!title || !url || !mergedAt || !createdAt) continue;
      const branch = text(pull.headRefName);
      merged.push({
        repo: name,
        title,
        branch,
        url,
        createdAt,
        mergedAt,
        botId: attributeBot({ repo: name, title, branch, map }),
      });
    }
    for (const pull of nodes(repo.openPullRequests)) {
      const title = clip(text(pull.title), 180);
      const url = text(pull.url);
      const createdAt = parseTimestamp(text(pull.createdAt));
      if (!title || !url || !createdAt) continue;
      const branch = text(pull.headRefName);
      open.push({
        repo: name,
        title,
        branch,
        url,
        createdAt,
        mergedAt: null,
        botId: attributeBot({ repo: name, title, branch, map }),
      });
    }
    const branchRef = record(repo.defaultBranchRef);
    const branch = text(branchRef?.name);
    const history = nodes(record(record(branchRef?.target)?.history));
    for (const commit of history) {
      const message = subject(text(commit.message));
      const at = parseTimestamp(text(commit.committedDate));
      const url = text(commit.url);
      if (!message || !at) continue;
      commits.push({
        repo: name,
        message,
        url,
        at,
        branch,
        botId: attributeBot({ repo: name, title: message, branch, map }),
      });
    }
  }
  return { merged, open, commits };
}

export function parseSearchBody(body: string, map: Record<string, string>): Pull[] | null {
  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    return null;
  }
  const items = record(json)?.items;
  if (!Array.isArray(items)) return null;
  const pulls: Pull[] = [];
  for (const item of items) {
    const row = record(item);
    if (!row) continue;
    const url = text(row.html_url);
    if (!url.includes("/pull/")) continue;
    const title = clip(text(row.title), 180);
    const createdAt = parseTimestamp(text(row.created_at));
    const repo = repoFromUrl(url);
    if (!title || !createdAt || !repo) continue;
    pulls.push({
      repo,
      title,
      branch: "",
      url,
      createdAt,
      mergedAt: null,
      botId: attributeBot({ repo, title, branch: "", map }),
    });
  }
  return pulls;
}
