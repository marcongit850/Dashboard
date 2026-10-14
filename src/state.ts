import { BOTS, botById, type Look } from "./bots";
import { normalizeBase } from "./paths";
import {
  commitEvent,
  COPY,
  finishedLine,
  mergedEvent,
  needBotTitle,
  postEvent,
  postureLine,
  statusEvent,
  agePhrase,
} from "./copy";
import { safeUrl } from "./html";
import { formatCt, startOfWeekCt, TWO_HOURS_MS, DAY_MS, WEEKDAY_LABELS, weekDayIndex, withinHours } from "./time";
import type { Commit, DocLink, Post, Pull, RawData, StatusRow } from "./types";

export type FeedItem = { at: Date; text: string; href: string };
export type NeedItem = { title: string; detail: string; href: string };
export type HistoryItem = { at: Date; text: string; href: string };
export type ReportLink = { label: string; href: string };

export type BotCard = {
  id: string;
  slug: string;
  name: string;
  busy: boolean;
  attention: boolean;
  bubble: string;
  workingNow: string;
  finishedLine: string;
  statusLine: string;
  look: Look;
  history: HistoryItem[];
  reports: ReportLink[];
};

export type DashboardModel = {
  now: Date;
  demo: boolean;
  loginEnabled: boolean;
  basePath: string;
  notes: string[];
  bots: BotCard[];
  feed: FeedItem[];
  week: { label: string; count: number }[];
  needs: NeedItem[];
  docs: DocLink[];
};

function latestRow(rows: StatusRow[], state?: StatusRow["state"]): StatusRow | null {
  let best: StatusRow | null = null;
  let bestIndex = -1;
  rows.forEach((row, index) => {
    if (state && row.state !== state) return;
    if (!best || row.at.getTime() > best.at.getTime() || (row.at.getTime() === best.at.getTime() && index > bestIndex)) {
      best = row;
      bestIndex = index;
    }
  });
  return best;
}

function newestText(options: { at: number; text: string }[]): string {
  const sorted = options.filter((item) => item.text).sort((a, b) => b.at - a.at || a.text.localeCompare(b.text));
  return sorted[0]?.text ?? "";
}

export function buildModel(
  data: RawData,
  now: Date,
  flags: { demo: boolean; loginEnabled: boolean; basePath?: string },
): DashboardModel {
  const feed: FeedItem[] = [];
  const botNeeds: { at: number; item: NeedItem }[] = [];
  const cards: BotCard[] = BOTS.map((bot) => {
    const posts = data.posts.filter((post) => post.botId === bot.id);
    const statuses = data.statuses.filter((row) => row.botId === bot.id);
    const merged = data.pulls.filter((pull) => pull.botId === bot.id && pull.mergedAt);
    const commits = data.commits.filter((commit) => commit.botId === bot.id);
    const latest = latestRow(statuses);
    const finished = latestRow(statuses, "finished");
    const busy =
      latest?.state === "started" ||
      posts.some((post) => withinHours(post.at, now, TWO_HOURS_MS)) ||
      merged.some((pull) => pull.mergedAt !== null && withinHours(pull.mergedAt, now, TWO_HOURS_MS)) ||
      commits.some((commit) => withinHours(commit.at, now, TWO_HOURS_MS));
    const attention = latest?.state === "blocked" || latest?.needsMarc === true;
    const taskBubble = latest && (latest.state === "started" || latest.state === "blocked") ? latest.task : "";
    const fallback = newestText([
      ...posts.map((post) => ({ at: post.at.getTime(), text: post.topic })),
      ...merged.map((pull) => ({ at: pull.mergedAt?.getTime() ?? 0, text: pull.title })),
      ...commits.map((commit) => ({ at: commit.at.getTime(), text: commit.message })),
    ]);
    let bubble = taskBubble || fallback;
    if (busy && !bubble) bubble = COPY.workingFallback;
    const workingNow = busy
      ? bubble
      : latest?.state === "blocked"
        ? latest.task || "Blocked"
        : COPY.idle;
    const history = [
      ...posts.map((post) => ({
        at: post.at,
        text: postEvent(bot.display, post.platform, post.site || post.source, post.topic),
        href: safeUrl(post.url),
      })),
      ...statuses.map((row) => ({
        at: row.at,
        text: statusEvent(bot.display, row.state === "unknown" ? "updated" : row.state, row.task),
        href: safeUrl(row.link),
      })),
      ...merged.map((pull) => ({
        at: pull.mergedAt ?? pull.createdAt,
        text: mergedEvent(bot.display, pull.title),
        href: safeUrl(pull.url),
      })),
      ...commits.map((commit) => ({
        at: commit.at,
        text: commitEvent(bot.display, commit.message),
        href: safeUrl(commit.url),
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime() || a.text.localeCompare(b.text))
      .slice(0, 100);
    const reports: ReportLink[] = [];
    const seen = new Set<string>();
    for (const item of history) {
      if (!item.href || seen.has(item.href)) continue;
      seen.add(item.href);
      reports.push({ label: item.text, href: item.href });
      if (reports.length === 40) break;
    }
    for (const post of posts) {
      feed.push({
        at: post.at,
        text: postEvent(bot.display, post.platform, post.site || post.source, post.topic),
        href: safeUrl(post.url),
      });
    }
    for (const row of statuses) {
      feed.push({
        at: row.at,
        text: statusEvent(bot.display, row.state === "unknown" ? "updated" : row.state, row.task),
        href: safeUrl(row.link),
      });
    }
    for (const pull of merged) {
      feed.push({
        at: pull.mergedAt ?? pull.createdAt,
        text: mergedEvent(bot.display, pull.title),
        href: safeUrl(pull.url),
      });
    }
    for (const commit of commits) {
      feed.push({
        at: commit.at,
        text: commitEvent(bot.display, commit.message),
        href: safeUrl(commit.url),
      });
    }
    if (latest && (latest.state === "blocked" || latest.needsMarc)) {
      botNeeds.push({
        at: latest.at.getTime(),
        item: {
          title: needBotTitle(bot.display, latest.state === "blocked", latest.needsMarc),
          detail: latest.task ? `${latest.task}, ${formatCt(latest.at)}` : formatCt(latest.at),
          href: safeUrl(latest.link),
        },
      });
    }
    return {
      id: bot.id,
      slug: bot.slug,
      name: bot.display,
      busy,
      attention,
      bubble: busy ? bubble : "",
      workingNow,
      finishedLine: finished ? finishedLine(finished.task, formatCt(finished.at)) : COPY.nothingFinished,
      statusLine: postureLine(busy, latest?.state === "blocked", latest?.needsMarc === true),
      look: bot.look,
      history,
      reports,
    };
  });

  const prNeeds: { at: number; item: NeedItem }[] = [];
  for (const pull of data.pulls) {
    if (pull.mergedAt) continue;
    if (now.getTime() - pull.createdAt.getTime() <= DAY_MS) continue;
    const owner = botById(pull.botId);
    prNeeds.push({
      at: pull.createdAt.getTime(),
      item: {
        title: pull.title,
        detail: `${pull.repo}, ${agePhrase(pull.createdAt, now)}${owner ? `, ${owner.display}` : ""}`,
        href: safeUrl(pull.url),
      },
    });
  }
  botNeeds.sort((a, b) => b.at - a.at);
  prNeeds.sort((a, b) => a.at - b.at);

  const weekStart = startOfWeekCt(now);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const post of data.posts) {
    const index = weekDayIndex(post.at, weekStart);
    if (index != null) counts[index] += 1;
  }

  return {
    now,
    demo: flags.demo,
    loginEnabled: flags.loginEnabled,
    basePath: normalizeBase(flags.basePath),
    notes: data.notes,
    bots: cards,
    feed: feed
      .sort((a, b) => b.at.getTime() - a.at.getTime() || a.text.localeCompare(b.text))
      .slice(0, 10),
    week: WEEKDAY_LABELS.map((label, index) => ({ label, count: counts[index] ?? 0 })),
    needs: [...botNeeds.map((item) => item.item), ...prNeeds.map((item) => item.item)],
    docs: data.docs,
  };
}

export function cardBySlug(model: DashboardModel, slug: string): BotCard | undefined {
  return model.bots.find((bot) => bot.slug === slug);
}
