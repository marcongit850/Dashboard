export const COPY = {
  title: "Team HQ",
  overview: "Overview",
  posts: "Posts",
  team: "Team",
  docs: "Docs",
  loginNotice: "Cloudflare Access is not enabled yet",
  passwordMissing: "Dashboard password is not configured.",
  loginTitle: "Team HQ login",
  loginPrompt: "Enter the dashboard password.",
  loginSubmit: "Enter",
  loginWrong: "Wrong password.",
  loginLimited: "Too many tries. Wait and try again.",
  logout: "Log out",
  passwordLabel: "Password",
  demoNotice: "Showing sample data.",
  floor: "One shared office. Data loads when you open the page.",
  legend: "Green means typing. A red mark means Marc is needed.",
  officeHint: "Slide sideways to see every desk.",
  postsIntro: "The latest events, posts this week in Central Time, and items that need Marc.",
  teamIntro: "Every bot, with what they are doing now and the last thing they finished.",
  liveFeed: "Live feed",
  postsThisWeek: "Posts this week",
  needsYou: "Needs you",
  weekCaption: "Monday through Sunday, Central Time.",
  chartLabel: "Bar chart of posts Monday through Sunday, Central Time.",
  noActivity: "No activity yet.",
  noPosts: "No posts this week.",
  nothingWaiting: "Nothing waiting on you.",
  idle: "Idle",
  nothingFinished: "Nothing finished yet",
  workingNow: "Working now",
  lastFinished: "Last finished",
  jobResponsibilities: "Job responsibilities",
  history: "History",
  reports: "Reports",
  noHistory: "No history yet.",
  noReports: "No reports yet.",
  docsIntro: "Key docs and sheets, grouped by owner.",
  handbook: "Handbook",
  noDocs: "No docs yet.",
  noHandbook: "No handbook yet.",
  noOtherDocs: "No other docs yet.",
  noBot: "No bot by that name.",
  notHere: "That page is not here.",
  back: "Back to Team HQ",
  forbidden: "Forbidden",
  methodNotAllowed: "Method not allowed",
  crash: "Team HQ could not load this page.",
  typing: "Typing now.",
  leaning: "Leaning back.",
  blocked: "Blocked.",
  needsMarc: "Needs Marc.",
  blockedNeeds: "Blocked, and needs Marc.",
  typingBlocked: "Typing now. Blocked.",
  typingNeeds: "Typing now. Needs Marc.",
  typingBlockedNeeds: "Typing now. Blocked, and needs Marc.",
  workingFallback: "Working",
  postsOff: "Posts sheet is not connected yet.",
  statusOff: "Status sheet is not connected yet.",
  docsOff: "Docs sheet is not connected yet.",
  githubOff: "GitHub is not connected yet.",
  githubDown: "GitHub could not be loaded.",
  githubHistoryDown: "GitHub history could not be loaded.",
  githubSearchDown: "GitHub open PR search could not be loaded.",
  badMap: "BOT_REPO_MAP is not valid JSON.",
  mapShape: "BOT_REPO_MAP must be a JSON object.",
  footer: "Team HQ loads data when you open a page. It does not refresh on its own.",
} as const;

export function postEvent(display: string, platform: string, place: string, topic: string): string {
  if (topic && platform) return `${display} posted on ${platform}: ${topic}`;
  if (topic && place) return `${display} posted in ${place}: ${topic}`;
  if (topic) return `${display} posted: ${topic}`;
  if (platform) return `${display} posted on ${platform}.`;
  if (place) return `${display} posted in ${place}.`;
  return `${display} posted.`;
}

export function statusEvent(display: string, state: string, task: string): string {
  if (task) return `${display} ${state}: ${task}`;
  return `${display} ${state}.`;
}

export function mergedEvent(display: string, title: string): string {
  return title ? `${display} merged: ${title}` : `${display} merged a PR.`;
}

export function commitEvent(display: string, message: string): string {
  return message ? `${display} committed: ${message}` : `${display} committed.`;
}

export function finishedLine(task: string, when: string): string {
  return task ? `${task}, ${when}` : `Finished, ${when}`;
}

export function needBotTitle(display: string, blocked: boolean, needs: boolean): string {
  if (blocked && needs) return `${display} is blocked and needs you`;
  if (blocked) return `${display} is blocked`;
  return `${display} needs you`;
}

export function postureLine(busy: boolean, blocked: boolean, needs: boolean): string {
  if (blocked && needs) return busy ? COPY.typingBlockedNeeds : COPY.blockedNeeds;
  if (blocked) return busy ? COPY.typingBlocked : COPY.blocked;
  if (needs) return busy ? COPY.typingNeeds : COPY.needsMarc;
  if (busy) return COPY.typing;
  return COPY.leaning;
}

export function agePhrase(from: Date, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 3_600_000));
  if (hours < 48) return hours === 1 ? "1 hour old" : `${hours} hours old`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day old" : `${days} days old`;
}

export function missingColumn(source: string, column: string): string {
  return `${source} is missing the ${column} column.`;
}

export function unreadableTimes(source: string): string {
  return `${source} has rows with unreadable times.`;
}

export function unknownBot(name: string, source: string): string {
  return `Unrecognized bot "${name}" in ${source}.`;
}

export function noRows(source: string): string {
  return `${source} has no rows yet.`;
}

export function httpsOnly(source: string): string {
  return `${source} needs an https URL.`;
}

export function loadFailed(source: string): string {
  return `${source} could not be loaded.`;
}
