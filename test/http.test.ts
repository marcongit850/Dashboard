import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemote, usableRemote } from "../src/http";

describe("github fetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps an ok body when the runtime leaves response.url empty", async () => {
    const response = new Response('{"login":"marcongit850"}', { status: 200 });
    expect(response.url).toBe("");
    expect(usableRemote(200, "")).toBe(true);
    expect(usableRemote(200, "https://api.github.com/graphql")).toBe(true);
    expect(usableRemote(200, "http://example.com/moved")).toBe(false);
    expect(usableRemote(403, "")).toBe(false);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const remote = await fetchRemote("https://api.github.com/graphql", {
      headers: { "User-Agent": "team-hq", Authorization: "Bearer test" },
      method: "POST",
      body: "{}",
    });
    expect(remote.status).toBe(200);
    expect(remote.body).toContain("marcongit850");
  });

  it("keeps the HTTP status when GitHub refuses the call", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"message":"bad token ghp_exampletokenvalue000000000000"}', { status: 403 }),
    );
    const remote = await fetchRemote("https://api.github.com/user", { headers: { "User-Agent": "team-hq" } });
    expect(remote.status).toBe(403);
    expect(remote.body).toBeNull();
    expect(remote.detail).not.toContain("ghp_");
    expect(remote.detail).toContain("[redacted]");
  });

  it("reports status 0 when the network fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    const remote = await fetchRemote("https://api.github.com/user", { headers: {} });
    expect(remote).toEqual({ status: 0, body: null, detail: "no response" });
  });
});
