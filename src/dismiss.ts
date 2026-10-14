import { botById, findBot, matchBot } from "./bots";
import type { StatusRow } from "./types";

export type ClearTarget = { botId: string; at: string };

const MIN_AT = Date.parse("2020-01-01T00:00:00.000Z");
const MAX_AT = Date.parse("2100-01-01T00:00:00.000Z");

export function dismissalKey(botId: string, at: Date): string {
  return `v1:${botId}:${at.getTime()}`;
}

export function clearTarget(botId: string, at: Date): ClearTarget {
  return { botId, at: at.toISOString() };
}

function latestByBot(rows: StatusRow[]): StatusRow[] {
  const best = new Map<string, { row: StatusRow; index: number }>();
  rows.forEach((row, index) => {
    const current = best.get(row.botId);
    if (
      !current ||
      row.at.getTime() > current.row.at.getTime() ||
      (row.at.getTime() === current.row.at.getTime() && index > current.index)
    ) {
      best.set(row.botId, { row, index });
    }
  });
  return [...best.values()].map((item) => item.row);
}

export function attentionRows(rows: StatusRow[]): { botId: string; at: Date }[] {
  return latestByBot(rows)
    .filter((row) => row.state === "blocked" || row.needsMarc)
    .map((row) => ({ botId: row.botId, at: row.at }));
}

export function sameOrigin(request: Request): boolean {
  let expected: string;
  try {
    expected = new URL(request.url).origin;
  } catch {
    return false;
  }
  const origin = request.headers.get("origin");
  if (!origin || origin === "null" || origin !== expected) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  return true;
}

function parseAt(raw: string | null): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(trimmed)) return null;
  const at = new Date(trimmed);
  const ms = at.getTime();
  if (!Number.isFinite(ms) || at.toISOString() !== trimmed) return null;
  if (ms < MIN_AT || ms > MAX_AT) return null;
  return at;
}

export function parseClearForm(body: string): { botId: string; at: Date } | null {
  if (body.length > 2048) return null;
  const params = new URLSearchParams(body);
  const named = params.get("bot") ?? "";
  const bot = botById(named) ?? findBot(named);
  const id = bot?.id ?? matchBot(named);
  if (!id || !botById(id)) return null;
  const at = parseAt(params.get("at"));
  if (!at) return null;
  return { botId: id, at };
}

export async function loadDismissals(
  kv: KVNamespace | undefined,
  rows: { botId: string; at: Date }[],
): Promise<Set<string>> {
  const keys = [...new Set(rows.map((row) => dismissalKey(row.botId, row.at)))];
  if (!kv || keys.length === 0) return new Set();
  try {
    const found = await kv.get(keys);
    const dismissed = new Set<string>();
    for (const [key, value] of found) {
      if (value) dismissed.add(key);
    }
    return dismissed;
  } catch {
    console.error(JSON.stringify({ event: "dismiss_read_failed" }));
    return new Set();
  }
}

export async function saveDismissal(kv: KVNamespace | undefined, botId: string, at: Date): Promise<"saved" | "missing" | "failed"> {
  if (!kv) return "missing";
  try {
    await kv.put(dismissalKey(botId, at), new Date().toISOString());
    return "saved";
  } catch {
    console.error(JSON.stringify({ event: "dismiss_write_failed", bot: botId }));
    return "failed";
  }
}
