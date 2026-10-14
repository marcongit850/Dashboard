import "./secrets";
import { cachedText, digestKey } from "./cache";
import { COPY, httpsOnly, loadFailed, noRows } from "./copy";
import {
  GITHUB_OWNER,
  GITHUB_QUERY,
  parseGraphqlBody,
  parseRepoMap,
  parseSearchBody,
} from "./github";
import { fetchSheet, fetchText, httpsUrl } from "./http";
import { parseDocs } from "./docs";
import { parsePostLog, parseStatus } from "./sheets";
import type { Commit, DocLink, Post, Pull, RawData, StatusRow } from "./types";

type SourceResult<T> = { rows: T[]; notes: string[] };

async function loadCsv(ctx: ExecutionContext, name: string, url: string): Promise<string | null> {
  if (!httpsUrl(url)) return null;
  const hash = await digestKey(url);
  return cachedText(ctx, `https://team-hq.internal/v1/csv/${hash}`, name, () =>
    fetchSheet(url, { Accept: "text/csv,text/plain,*/*", "User-Agent": "team-hq" }),
  );
}

async function loadPosts(env: Env, ctx: ExecutionContext): Promise<SourceResult<Post>> {
  const url = env.POSTS_CSV_URL.trim();
  if (!url) return { rows: [], notes: [COPY.postsOff] };
  if (!httpsUrl(url)) return { rows: [], notes: [httpsOnly("Posts sheet")] };
  const body = await loadCsv(ctx, "Posts sheet", url);
  if (body == null) return { rows: [], notes: [loadFailed("Posts sheet")] };
  const sheet = parsePostLog(body);
  const notes = sheet.notes.slice();
  if (!sheet.posts.length && !notes.length) notes.push(noRows("Posts sheet"));
  return { rows: sheet.posts, notes };
}

async function loadStatus(env: Env, ctx: ExecutionContext): Promise<SourceResult<StatusRow>> {
  const url = env.STATUS_CSV_URL.trim();
  if (!url) return { rows: [], notes: [COPY.statusOff] };
  if (!httpsUrl(url)) return { rows: [], notes: [httpsOnly("Status sheet")] };
  const body = await loadCsv(ctx, "Status sheet", url);
  if (body == null) return { rows: [], notes: [loadFailed("Status sheet")] };
  const sheet = parseStatus(body);
  const notes = sheet.notes.slice();
  if (!sheet.rows.length && !notes.length) notes.push(noRows("Status sheet"));
  return { rows: sheet.rows, notes };
}

async function loadDocs(env: Env, ctx: ExecutionContext): Promise<SourceResult<DocLink>> {
  const url = env.DOCS_CSV_URL.trim();
  if (!url) return { rows: [], notes: [COPY.docsOff] };
  if (!httpsUrl(url)) return { rows: [], notes: [httpsOnly("Docs sheet")] };
  const body = await loadCsv(ctx, "Docs sheet", url);
  if (body == null) return { rows: [], notes: [loadFailed("Docs sheet")] };
  const sheet = parseDocs(body);
  const notes = sheet.notes.slice();
  if (!sheet.docs.length && !notes.length) notes.push(noRows("Docs sheet"));
  return { rows: sheet.docs, notes };
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "team-hq",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function loadGithub(env: Env, ctx: ExecutionContext): Promise<{ pulls: Pull[]; commits: Commit[]; notes: string[] }> {
  const mapResult = parseRepoMap(env.BOT_REPO_MAP);
  const notes = mapResult.error ? [mapResult.error] : [];
  const token = env.GITHUB_TOKEN?.trim() ?? "";
  if (!token) return { pulls: [], commits: [], notes: [...notes, COPY.githubOff] };
  const hash = await digestKey(token);
  const headers = githubHeaders(token);
  const [graphqlBody, searchBody] = await Promise.all([
    cachedText(ctx, `https://team-hq.internal/v1/github/graphql/${hash}`, "github_graphql", async () => {
      const text = await fetchText(
        "https://api.github.com/graphql",
        { ...headers, "Content-Type": "application/json" },
        "POST",
        JSON.stringify({ query: GITHUB_QUERY, variables: { login: GITHUB_OWNER } }),
      );
      if (!text || !parseGraphqlBody(text, mapResult.map)) return null;
      return text;
    }),
    cachedText(ctx, `https://team-hq.internal/v1/github/search/${hash}`, "github_search", async () => {
      const query = `user:${GITHUB_OWNER} is:pr is:open`;
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=asc&per_page=50`;
      const text = await fetchText(url, headers);
      if (!text || !parseSearchBody(text, mapResult.map)) return null;
      return text;
    }),
  ]);
  const graphql = graphqlBody ? parseGraphqlBody(graphqlBody, mapResult.map) : null;
  const search = searchBody ? parseSearchBody(searchBody, mapResult.map) : null;
  if (!graphql && !search) return { pulls: [], commits: [], notes: [...notes, COPY.githubDown] };
  if (!graphql) notes.push(COPY.githubHistoryDown);
  if (!search) notes.push(COPY.githubSearchDown);
  const open = new Map<string, Pull>();
  for (const pull of graphql?.open ?? []) open.set(pull.url, pull);
  for (const pull of search ?? []) {
    if (!open.has(pull.url)) open.set(pull.url, pull);
  }
  return {
    pulls: [...(graphql?.merged ?? []), ...open.values()],
    commits: graphql?.commits ?? [],
    notes,
  };
}

export async function loadRaw(env: Env, ctx: ExecutionContext): Promise<RawData> {
  const [posts, statuses, github, docs] = await Promise.all([
    loadPosts(env, ctx),
    loadStatus(env, ctx),
    loadGithub(env, ctx),
    loadDocs(env, ctx),
  ]);
  return {
    posts: posts.rows,
    statuses: statuses.rows,
    pulls: github.pulls,
    commits: github.commits,
    docs: docs.rows,
    notes: [...posts.notes, ...statuses.notes, ...github.notes, ...docs.notes],
  };
}
