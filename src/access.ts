import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const jwksByIssuer = new Map<string, JWTVerifyGetKey>();

export function accessMode(aud: string | undefined, team: string | undefined): "off" | "on" | "partial" {
  const hasAud = Boolean(aud?.trim());
  const hasTeam = Boolean(team?.trim());
  if (hasAud && hasTeam) return "on";
  if (hasAud || hasTeam) return "partial";
  return "off";
}

export function teamIssuer(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" || !url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function jwksFor(issuer: string): JWTVerifyGetKey {
  const existing = jwksByIssuer.get(issuer);
  if (existing) return existing;
  const created = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  jwksByIssuer.set(issuer, created);
  return created;
}

export type AccessDecision = { ok: boolean; loginEnabled: boolean };

export async function authorize(request: Request, env: Env): Promise<AccessDecision> {
  const mode = accessMode(env.ACCESS_AUD, env.ACCESS_TEAM_DOMAIN);
  if (mode === "off") return { ok: true, loginEnabled: false };
  if (mode === "partial") {
    console.error(JSON.stringify({ event: "access_config_incomplete" }));
    return { ok: false, loginEnabled: true };
  }
  const issuer = teamIssuer(env.ACCESS_TEAM_DOMAIN);
  if (!issuer) {
    console.error(JSON.stringify({ event: "access_config_incomplete" }));
    return { ok: false, loginEnabled: true };
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    console.error(JSON.stringify({ event: "access_jwt_missing" }));
    return { ok: false, loginEnabled: true };
  }
  try {
    await jwtVerify(token, jwksFor(issuer), {
      issuer,
      audience: env.ACCESS_AUD.trim(),
      clockTolerance: "60s",
    });
    return { ok: true, loginEnabled: true };
  } catch {
    console.error(JSON.stringify({ event: "access_jwt_rejected" }));
    return { ok: false, loginEnabled: true };
  }
}
