import "./secrets";
import { cachedText, digestKey } from "./cache";
import { COPY, githubDownNote, githubHistoryFailed, githubSearchFailed, httpsOnly, loadFailed, noRows } from "./copy";
import {
  GITHUB_OWNER,
  GITHUB_QUERY,
  githubAuthorization,
  graphqlProblem,
  parseGraphqlBody,
  parseRepoMap,
  parseRestCommits,
  parseRestPulls,
  parseRestRepoNames,
  parseSearchBody,
  restHistoryFromRepos,
  type GithubWork,
} from "./github";
import { fetchSheet, fetchRemote, httpsUrl } from "./http";
import { clip, redactSecrets } from "./html";
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

type GithubAttempt = { status: number; text: string | null; readable: boolean };

function githubHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: githubAuthorization(token),
    "User-Agent": "team-hq",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function githubPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

async function githubGet(
  ctx: ExecutionContext,
  token: string,
  url: string,
  init: { method?: "GET" | "POST"; body?: string },
  accept: (text: string) => boolean,
  problem: (text: string) => string,
): Promise<GithubAttempt> {
  let status = 0;
  let readable = true;
  const key = await digestKey(`${token}\n${init.method ?? "GET"}\n${url}\n${init.body ?? ""}`);
  const text = await cachedText(ctx, `https://team-hq.internal/v1/github/${key}`, "github", async () => {
    const remote = await fetchRemote(url, {
      headers: githubHeaders(token, init.method === "POST"),
      method: init.method,
      body: init.body,
    });
    status = remote.status;
    const path = githubPath(url);
    console.log(JSON.stringify({ event: "github_response", path, status: remote.status }));
    if (remote.body == null || !accept(remote.body)) {
      readable = !(remote.body != null && remote.status >= 200 && remote.status < 300);
      const detail = remote.body ? problem(remote.body) : remote.detail || "no response";
      console.error(JSON.stringify({
        event: "github_http_error",
        path,
        status: remote.status,
        detail: clip(redactSecrets(detail), 180),
      }));
      return null;
    }
    readable = true;
    return remote.body;
  });
  return { status, text, readable };
}

async function loadRestHistory(
  ctx: ExecutionContext,
  token: string,
  map: Record<string, string>,
): Promise<{ work: GithubWork | null; status: number; readable: boolean }> {
  const listUrl = `https://api.github.com/users/${GITHUB_OWNER}/repos?sort=pushed&per_page=12&type=owner`;
  const list = await githubGet(ctx, token, listUrl, {}, (text) => parseRestRepoNames(text) !== null, () => "unexpected response");
  if (!list.text) return { work: null, status: list.status, readable: list.readable };
  const names = parseRestRepoNames(list.text) ?? [];
  const repos = await Promise.all(names.map(async (name) => {
    const root = `https://api.github.com/repos/${GITHUB_OWNER}/${encodeURIComponent(name)}`;
    const [closed, opened, history] = await Promise.all([
      githubGet(ctx, token, `${root}/pulls?state=closed&sort=updated&direction=desc&per_page=5`, {}, (text) => parseRestPulls(text, name, map, "merged") !== null, () => "unexpected response"),
      githubGet(ctx, token, `${root}/pulls?state=open&sort=created&direction=asc&per_page=8`, {}, (text) => parseRestPulls(text, name, map, "open") !== null, () => "unexpected response"),
      githubGet(ctx, token, `${root}/commits?per_page=3`, {}, (text) => parseRestCommits(text, name, map) !== null, () => "unexpected response"),
    ]);
    return { name, closed: closed.text, open: opened.text, commits: history.text, attempts: [closed, opened, history] };
  }));
  const collected = restHistoryFromRepos(repos, map);
  if (collected.work) return { work: collected.work, status: 200, readable: true };
  const attempts = repos.flatMap((repo) => repo.attempts);
  const httpFail = attempts.find((attempt) => attempt.status < 200 || attempt.status >= 300);
  const chosen = httpFail ?? attempts[0];
  return { work: null, status: chosen?.status ?? list.status, readable: chosen?.readable ?? false };
}

async function loadGithub(env: Env, ctx: ExecutionContext): Promise<{ pulls: Pull[]; commits: Commit[]; notes: string[] }> {
  const mapResult = parseRepoMap(env.BOT_REPO_MAP);
  const notes = mapResult.error ? [mapResult.error] : [];
  const token = env.GITHUB_TOKEN?.trim() ?? "";
  if (!token) return { pulls: [], commits: [], notes: [...notes, COPY.githubOff] };
  const query = `user:${GITHUB_OWNER} is:pr is:open`;
  const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=asc&per_page=50`;
  const graphqlUrl = "https://api.github.com/graphql";
  const graphqlBody = JSON.stringify({ query: GITHUB_QUERY, variables: { login: GITHUB_OWNER } });
  const searchPromise = githubGet(ctx, token, searchUrl, {}, (text) => parseSearchBody(text, mapResult.map) !== null, () => "unexpected response");
  const graphql = await githubGet(
    ctx,
    token,
    graphqlUrl,
    { method: "POST", body: graphqlBody },
    (text) => parseGraphqlBody(text, mapResult.map) !== null,
    graphqlProblem,
  );
  let work = graphql.text ? parseGraphqlBody(graphql.text, mapResult.map) : null;
  let historyStatus = graphql.status;
  let historyReadable = graphql.readable;
  if (!work) {
    const rest = await loadRestHistory(ctx, token, mapResult.map);
    work = rest.work;
    historyStatus = rest.status;
    historyReadable = rest.readable;
  }
  const searchAttempt = await searchPromise;
  const search = searchAttempt.text ? parseSearchBody(searchAttempt.text, mapResult.map) : null;
  if (!work && !search) {
    notes.push(githubDownNote(historyStatus, searchAttempt.status));
  } else {
    if (!work) notes.push(githubHistoryFailed(historyStatus, historyReadable));
    if (!search) notes.push(githubSearchFailed(searchAttempt.status, searchAttempt.readable));
  }
  const open = new Map<string, Pull>();
  for (const pull of work?.open ?? []) open.set(pull.url, pull);
  for (const pull of search ?? []) {
    if (!open.has(pull.url)) open.set(pull.url, pull);
  }
  return {
    pulls: [...(work?.merged ?? []), ...open.values()],
    commits: work?.commits ?? [],
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
