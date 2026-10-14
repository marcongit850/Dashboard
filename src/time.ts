export const CT = "America/Chicago";
export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const wallFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CT,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const displayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CT,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export type Wall = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function ctWallParts(date: Date): Wall {
  const parts = wallFormatter.formatToParts(date);
  let year = Number(part(parts, "year"));
  let month = Number(part(parts, "month"));
  let day = Number(part(parts, "day"));
  let hour = Number(part(parts, "hour"));
  if (hour === 24) {
    hour = 0;
    const next = addCalendarDays(year, month, day, 1);
    year = next.year;
    month = next.month;
    day = next.day;
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(part(parts, "minute")),
    second: Number(part(parts, "second")),
    weekday: part(parts, "weekday"),
  };
}

export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

export function ctWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = desired;
  for (let i = 0; i < 4; i += 1) {
    const got = ctWallParts(new Date(utc));
    const gotUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    const delta = desired - gotUtc;
    if (delta === 0) return new Date(utc);
    utc += delta;
  }
  const check = ctWallParts(new Date(utc));
  if (
    check.year !== year ||
    check.month !== month ||
    check.day !== day ||
    check.hour !== hour ||
    check.minute !== minute
  ) {
    return null;
  }
  return new Date(utc);
}

export function parseTimestamp(input: string): Date | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    return ctWallToUtc(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      match[4] ? Number(match[4]) : 0,
      match[5] ? Number(match[5]) : 0,
      match[6] ? Number(match[6]) : 0,
    );
  }
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?)?$/i);
  if (!match) return null;
  let hour = match[4] ? Number(match[4]) : 0;
  const ampm = (match[7] ?? "").toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return ctWallToUtc(
    Number(match[3]),
    Number(match[1]),
    Number(match[2]),
    hour,
    match[5] ? Number(match[5]) : 0,
    match[6] ? Number(match[6]) : 0,
  );
}

export function formatCt(date: Date, withWeekday = false): string {
  const parts = displayFormatter.formatToParts(date);
  const month = part(parts, "month");
  const day = part(parts, "day");
  const hour = part(parts, "hour");
  const minute = part(parts, "minute").padStart(2, "0");
  const period = part(parts, "dayPeriod");
  const clock = `${month} ${day}, ${hour}:${minute} ${period} CT`;
  if (!withWeekday) return clock;
  return `${part(parts, "weekday")} ${clock}`;
}

export function startOfWeekCt(now: Date): Date {
  const wall = ctWallParts(now);
  const weekday = WEEK.indexOf(wall.weekday);
  const fromMonday = weekday < 0 ? 0 : (weekday + 6) % 7;
  const monday = addCalendarDays(wall.year, wall.month, wall.day, -fromMonday);
  return ctWallToUtc(monday.year, monday.month, monday.day, 0, 0, 0) ?? now;
}

export function weekDayIndex(date: Date, weekStart: Date): number | null {
  const start = ctWallParts(weekStart);
  const current = ctWallParts(date);
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const currentUtc = Date.UTC(current.year, current.month - 1, current.day);
  const days = Math.round((currentUtc - startUtc) / 86_400_000);
  if (days < 0 || days > 6) return null;
  return days;
}

export function withinHours(at: Date, now: Date, windowMs: number): boolean {
  const delta = now.getTime() - at.getTime();
  return delta >= 0 && delta <= windowMs;
}
