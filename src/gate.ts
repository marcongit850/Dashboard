export const SESSION_COOKIE = "hq_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;

type Bucket = { fails: number; reset: number };
const buckets = new Map<string, Bucket>();

export function passwordConfigured(password: string | undefined): boolean {
  return Boolean(password?.trim());
}

export function cookieKey(password: string | undefined, cookieSecret: string | undefined): string {
  const dedicated = cookieSecret?.trim() ?? "";
  if (dedicated) return dedicated;
  return password?.trim() ?? "";
}

export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const len = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < len; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

export async function passwordsMatch(input: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  try {
    const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

export async function issueSession(secret: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const payload = `v1.${exp}`;
  const sig = bytesToBase64Url(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export async function sessionValid(token: string, secret: string, now = Date.now()): Promise<boolean> {
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expRaw, sig] = parts;
  if (version !== "v1" || !expRaw || !sig || !/^\d{1,12}$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return false;
  const expected = bytesToBase64Url(await hmac(secret, `v1.${expRaw}`));
  const got = base64UrlToBytes(sig);
  const want = base64UrlToBytes(expected);
  if (!got || !want) return false;
  return timingSafeEqual(got, want);
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}

export async function requestHasSession(request: Request, secret: string, now = Date.now()): Promise<boolean> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return false;
  return sessionValid(token, secret, now);
}

function cookiePath(base: string): string {
  return base || "/";
}

export function sessionCookie(token: string, base: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=${cookiePath(base)}; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie(base: string): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=${cookiePath(base)}; Max-Age=0`;
}

function prune(now: number): void {
  if (buckets.size < 200) return;
  for (const [key, bucket] of buckets) {
    if (bucket.reset <= now) buckets.delete(key);
  }
}

export function rateLimited(ip: string, now = Date.now()): boolean {
  const bucket = buckets.get(ip);
  if (!bucket || bucket.reset <= now) return false;
  return bucket.fails >= MAX_FAILS;
}

export function noteFailure(ip: string, now = Date.now()): void {
  prune(now);
  const bucket = buckets.get(ip);
  if (!bucket || bucket.reset <= now) {
    buckets.set(ip, { fails: 1, reset: now + WINDOW_MS });
    return;
  }
  bucket.fails += 1;
}

export function clearFailures(ip: string): void {
  buckets.delete(ip);
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || "local";
}
