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
