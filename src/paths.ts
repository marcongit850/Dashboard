export function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "/") return "";
  let path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  path = path.replace(/\/+$/, "");
  if (!path.startsWith("/") || path.includes("//") || path.includes("\\") || path.includes("?") || path.includes("#")) {
    return "";
  }
  if (path.split("/").some((part) => part === "." || part === "..")) return "";
  return path;
}

export function withBase(base: string, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (!base) return suffix;
  if (suffix === "/") return base;
  return `${base}${suffix}`;
}

export function logicalPath(pathname: string, base: string): string {
  let path = pathname || "/";
  if (base) {
    if (path === base) path = "/";
    else if (path.startsWith(`${base}/`)) path = path.slice(base.length) || "/";
  }
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

export type BaseHit = "in" | "root" | "out";

export function baseHit(pathname: string, base: string): BaseHit {
  if (!base) return "in";
  if (pathname === "/" || pathname === "") return "root";
  if (pathname === base || pathname.startsWith(`${base}/`)) return "in";
  return "out";
}

export function safeNext(base: string, raw: string | null, origin: string): string {
  const home = base || "/";
  if (!raw) return home;
  const value = raw.trim();
  if (!value || value.length > 500) return home;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return home;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return home;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("://")) return home;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return home;
  }
  if (url.origin !== origin) return home;
  const path = url.pathname;
  if (base && path !== base && !path.startsWith(`${base}/`)) return home;
  const login = withBase(base, "/login");
  const logout = withBase(base, "/logout");
  const clear = withBase(base, "/clear");
  if (path === login || path === logout || path === clear) return home;
  return `${url.pathname}${url.search}${url.hash}`;
}
