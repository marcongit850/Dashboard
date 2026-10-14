const MAX_BYTES = 1_500_000;

async function readLimited(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

// A published sheet URL may 307 to googleusercontent.com. The next hop must keep the same gid.
// Never follow a redirect onto a different tab. The docs workbook has private tabs.
export function sameConfiguredGid(configured: string, next: string): boolean {
  let from: URL;
  let to: URL;
  try {
    from = new URL(configured);
    to = new URL(next, configured);
  } catch {
    return false;
  }
  if (to.protocol !== "https:" || to.username || to.password) return false;
  const gid = from.searchParams.get("gid");
  if (gid == null) return !to.searchParams.has("gid");
  return to.searchParams.get("gid") === gid;
}

export async function fetchSheet(url: string, headers: HeadersInit): Promise<string | null> {
  let current = url;
  try {
    for (let hop = 0; hop < 3; hop += 1) {
      const response = await fetch(current, {
        method: "GET",
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || !sameConfiguredGid(url, location)) return null;
        current = new URL(location, current).toString();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      return await readLimited(response);
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchText(url: string, headers: HeadersInit, method: "GET" | "POST" = "GET", body?: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || !response.url.startsWith("https://")) {
      await response.body?.cancel();
      return null;
    }
    return await readLimited(response);
  } catch {
    return null;
  }
}

export function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}
