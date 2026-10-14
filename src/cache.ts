export const CACHE_TTL_SECONDS = 300;

export async function digestKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function cachedText(
  ctx: ExecutionContext,
  keyUrl: string,
  source: string,
  loader: () => Promise<string | null>,
): Promise<string | null> {
  const key = new Request(keyUrl, { method: "GET" });
  try {
    const hit = await caches.default.match(key);
    if (hit) return await hit.text();
  } catch {
    // The Cache API is unavailable in some local tools. Fall through to a live read.
  }
  const body = await loader();
  if (body == null) {
    console.error(JSON.stringify({ event: "upstream_failed", source }));
    return null;
  }
  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
    },
  });
  try {
    ctx.waitUntil(
      caches.default.put(key, response.clone()).catch(() => {
        console.error(JSON.stringify({ event: "cache_put_failed", source }));
      }),
    );
  } catch {
    console.error(JSON.stringify({ event: "cache_put_failed", source }));
  }
  return body;
}
