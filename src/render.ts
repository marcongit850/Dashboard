import { COPY } from "./copy";
import { groupDocs, handbookFor, otherDocsFor } from "./docs";
import { escapeHtml } from "./html";
import { characterSvg, roomSvg } from "./office";
import { type BotCard, type DashboardModel, type FeedItem, type NeedItem } from "./state";
import type { DocLink } from "./types";
import { formatCt } from "./time";

function href(path: string, demo: boolean, hash = ""): string {
  if (!demo) return `${path}${hash}`;
  return `${path}?demo=1${hash}`;
}

function header(demo: boolean, clock: string): string {
  const links = [
    [href("/", demo, "#overview"), COPY.overview],
    [href("/", demo, "#posts"), COPY.posts],
    [href("/", demo, "#team"), COPY.team],
    [href("/docs", demo), COPY.docs],
  ];
  return `<header class="top"><div class="bar">
    <h1><a class="logo" href="${href("/", demo)}">${COPY.title}</a></h1>
    <nav class="nav">${links.map(([path, label]) => `<a href="${path}">${label}</a>`).join("")}</nav>
    <p class="clock">${escapeHtml(clock)}</p>
  </div></header>`;
}

function notices(model: DashboardModel): string {
  const login = model.loginEnabled ? "" : `<p class="notice">${COPY.loginNotice}</p>`;
  const demo = model.demo ? `<p class="notice demo">${COPY.demoNotice}</p>` : "";
  const notes = model.notes.length
    ? `<ul class="warnings">${model.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
    : "";
  return `${login}${demo}${notes}`;
}

function shell(model: Pick<DashboardModel, "demo" | "loginEnabled" | "now" | "notes">, title: string, main: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b1220">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/hq.css">
</head>
<body>
${header(model.demo, formatCt(model.now, true))}
<main>
${notices(model as DashboardModel)}
${main}
</main>
<footer><p>${COPY.footer}</p></footer>
</body>
</html>`;
}

function seat(card: BotCard, demo: boolean, linked: boolean, index?: number): string {
  const pose = card.busy ? "busy" : "idle";
  const alert = card.attention ? " alert" : "";
  const spot = index == null ? "" : ` at-${index}`;
  const bubble = card.bubble ? `<p class="bubble">${escapeHtml(card.bubble)}</p>` : "";
  const bang = card.attention ? `<span class="bang"><span class="sr">${COPY.needsMarc}</span>!</span>` : "";
  const actor = `<span class="actor">${characterSvg(card.look, card.busy ? "type" : "lean")}${bang}</span>`;
  const tag = `<span class="tag"><span class="dot" aria-hidden="true"></span>${escapeHtml(card.name)}</span>`;
  const label = card.bubble ? `${card.name}, ${card.statusLine}, ${card.bubble}` : `${card.name}, ${card.statusLine}`;
  const inner = `${bubble}${actor}${tag}`;
  if (!linked) return `<div class="seat portrait ${pose}${alert}">${inner}</div>`;
  return `<a class="seat ${pose}${alert}${spot}" href="${href(`/bot/${card.slug}`, demo)}" aria-label="${escapeHtml(label)}">${inner}</a>`;
}

function docItem(doc: DocLink): string {
  const about = doc.about ? `<p>${escapeHtml(doc.about)}</p>` : "";
  return `<li><a href="${escapeHtml(doc.url)}" rel="noreferrer noopener">${escapeHtml(doc.name)}</a>${about}</li>`;
}

function docList(docs: DocLink[], empty: string): string {
  if (!docs.length) return `<p class="empty">${empty}</p>`;
  return `<ul class="docs">${docs.map(docItem).join("")}</ul>`;
}

function eventList(items: FeedItem[], empty: string, className: string): string {
  if (!items.length) return `<p class="empty">${empty}</p>`;
  return `<ol class="${className}">${items.map((item) => {
    const body = item.href
      ? `<a href="${escapeHtml(item.href)}" rel="noreferrer noopener">${escapeHtml(item.text)}</a>`
      : `<p>${escapeHtml(item.text)}</p>`;
    return `<li><time datetime="${item.at.toISOString()}">${formatCt(item.at)}</time>${body}</li>`;
  }).join("")}</ol>`;
}

function needsList(items: NeedItem[]): string {
  if (!items.length) return `<p class="empty">${COPY.nothingWaiting}</p>`;
  return `<ul class="needs">${items.map((item) => {
    const title = item.href
      ? `<a href="${escapeHtml(item.href)}" rel="noreferrer noopener">${escapeHtml(item.title)}</a>`
      : `<p>${escapeHtml(item.title)}</p>`;
    return `<li>${title}<p>${escapeHtml(item.detail)}</p></li>`;
  }).join("")}</ul>`;
}

function weekChart(days: { label: string; count: number }[]): string {
  const width = 320;
  const height = 168;
  const base = 124;
  const maxBar = 96;
  const max = Math.max(1, ...days.map((day) => day.count));
  const barW = 28;
  const gap = 14;
  const total = days.length * barW + (days.length - 1) * gap;
  const origin = Math.round((width - total) / 2);
  const bars = days.map((day, index) => {
    const barHeight = day.count === 0 ? 0 : Math.max(4, Math.round((day.count / max) * maxBar));
    const x = origin + index * (barW + gap);
    const y = base - barHeight;
    const count = day.count > 0
      ? `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" fill="#e7eefc" font-size="11" font-family="ui-monospace, monospace">${day.count}</text>`
      : "";
    const label = `<text x="${x + barW / 2}" y="${base + 16}" text-anchor="middle" fill="#93a4c7" font-size="11" font-family="ui-monospace, monospace">${day.label}</text>`;
    const rect = barHeight > 0 ? `<rect x="${x}" y="${y}" width="${barW}" height="${barHeight}" fill="#5ee0a0"/>` : "";
    return `${rect}${count}${label}`;
  }).join("");
  const axis = `<line x1="${origin}" y1="${base}" x2="${origin + total - gap}" y2="${base}" stroke="#2a3d66" stroke-width="2"/>`;
  const empty = days.every((day) => day.count === 0) ? `<p class="empty">${COPY.noPosts}</p>` : "";
  return `${empty}<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(COPY.chartLabel)}">${axis}${bars}</svg><p class="fine">${COPY.weekCaption}</p>`;
}

export function renderHome(model: DashboardModel): string {
  const seats = model.bots.map((bot, index) => seat(bot, model.demo, true, index)).join("");
  const roster = `<ul class="roster">${model.bots.map((bot) => {
    const pose = bot.busy ? "on" : "off";
    const alert = bot.attention ? " alert" : "";
    return `<li class="${pose}${alert}"><a href="${href(`/bot/${bot.slug}`, model.demo)}">${escapeHtml(bot.name)}</a><p><span class="k">${COPY.workingNow}:</span> ${escapeHtml(bot.workingNow)}</p><p><span class="k">${COPY.lastFinished}:</span> ${escapeHtml(bot.finishedLine)}</p></li>`;
  }).join("")}</ul>`;
  const main = `<section id="overview">
    <h2>${COPY.overview}</h2>
    <p>${COPY.floor}</p>
    <p class="legend">${COPY.legend}</p>
    <p class="scroll-hint">${COPY.officeHint}</p>
    <div class="office-scroll"><div class="office">${roomSvg()}${seats}</div></div>
  </section>
  <section id="posts">
    <h2>${COPY.posts}</h2>
    <p>${COPY.postsIntro}</p>
    <div class="panels">
      <article class="panel feed-panel"><h3>${COPY.liveFeed}</h3>${eventList(model.feed, COPY.noActivity, "feed")}</article>
      <article class="panel chart-panel"><h3>${COPY.postsThisWeek}</h3>${weekChart(model.week)}</article>
      <article class="panel needs-panel"><h3>${COPY.needsYou}</h3>${needsList(model.needs)}</article>
    </div>
  </section>
  <section id="team">
    <h2>${COPY.team}</h2>
    <p>${COPY.teamIntro}</p>
    ${roster}
  </section>`;
  return shell(model, COPY.title, main);
}

export function renderBot(model: DashboardModel, card: BotCard): string {
  const handbook = handbookFor(model.docs, card.id);
  const others = otherDocsFor(model.docs, card.id, handbook);
  const history = card.history.length
    ? eventList(card.history, COPY.noHistory, "history")
    : `<p class="empty">${COPY.noHistory}</p>`;
  const reports = card.reports.length
    ? `<ul class="reports">${card.reports.map((report) => `<li><a href="${escapeHtml(report.href)}" rel="noreferrer noopener">${escapeHtml(report.label)}</a></li>`).join("")}</ul>`
    : `<p class="empty">${COPY.noReports}</p>`;
  const main = `<p class="back"><a href="${href("/", model.demo)}">${COPY.back}</a></p>
  <div class="bot-hero">
    ${seat(card, model.demo, false)}
    <div>
      <h2>${escapeHtml(card.name)}</h2>
      <p class="posture">${escapeHtml(card.statusLine)}</p>
      <p><span class="k">${COPY.workingNow}:</span> ${escapeHtml(card.workingNow)}</p>
      <p><span class="k">${COPY.lastFinished}:</span> ${escapeHtml(card.finishedLine)}</p>
    </div>
  </div>
  <section>
    <h2>${COPY.history}</h2>
    ${history}
  </section>
  <section>
    <h2>${COPY.reports}</h2>
    ${reports}
  </section>
  <section>
    <h2>${COPY.handbook}</h2>
    ${handbook ? docList([handbook], COPY.noHandbook) : `<p class="empty">${COPY.noHandbook}</p>`}
  </section>
  <section>
    <h2>${COPY.docs}</h2>
    ${docList(others, handbook ? COPY.noOtherDocs : COPY.noDocs)}
  </section>`;
  return shell(model, `${card.name}, ${COPY.title}`, main);
}

export function renderDocs(model: DashboardModel): string {
  const groups = groupDocs(model.docs);
  const body = groups.length
    ? groups.map((group) => `<section class="doc-group"><h3>${escapeHtml(group.label)}</h3>${docList(group.docs, COPY.noDocs)}</section>`).join("")
    : `<p class="empty">${model.notes.includes(COPY.docsOff) ? COPY.docsOff : COPY.noDocs}</p>`;
  const main = `<section id="docs"><h2>${COPY.docs}</h2><p>${COPY.docsIntro}</p>${body}</section>`;
  return shell(model, `${COPY.docs}, ${COPY.title}`, main);
}

export function renderMissing(model: DashboardModel, missingBot: boolean): string {
  const main = `<section><h2>${missingBot ? COPY.noBot : COPY.notHere}</h2><p class="back"><a href="${href("/", model.demo)}">${COPY.back}</a></p></section>`;
  return shell(model, `${COPY.title}`, main);
}

export function renderCrash(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${COPY.title}</title></head><body><h1>${COPY.title}</h1><p>${COPY.crash}</p></body></html>`;
}
