import "server-only";

import crypto from "node:crypto";

function normalizeOrigin(value?: string | null) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function toPublicOrigin(origin: string) {
  const url = new URL(origin);
  if (url.hostname === "0.0.0.0" || url.hostname === "::" || url.hostname === "[::]") {
    url.hostname = "localhost";
  }
  return url.origin;
}

function getConfiguredBaseUrl() {
  const candidates = [
    process.env.PASSWORD_RESET_BASE_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) {
      return toPublicOrigin(normalized);
    }
  }

  return null;
}

function getRequestBaseUrl(req: Request) {
  const originHeader = normalizeOrigin(req.headers.get("origin"));
  if (originHeader) return toPublicOrigin(originHeader);

  const refererHeader = normalizeOrigin(req.headers.get("referer"));
  if (refererHeader) return toPublicOrigin(refererHeader);

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto && forwardedHost) {
    return toPublicOrigin(`${forwardedProto}://${forwardedHost}`);
  }

  const requestUrl = new URL(req.url);
  const host = req.headers.get("host")?.trim();
  if (host) {
    return toPublicOrigin(`${requestUrl.protocol}//${host}`);
  }

  return toPublicOrigin(requestUrl.origin);
}

export function getPasswordResetTokenTtlMinutes() {
  const raw = Number(process.env.PASSWORD_RESET_TOKEN_MINUTES ?? 60);
  return Number.isFinite(raw) && raw >= 15 && raw <= 24 * 60 ? Math.floor(raw) : 60;
}

export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    expiresAt: new Date(Date.now() + getPasswordResetTokenTtlMinutes() * 60_000),
    token,
    tokenHash: hashPasswordResetToken(token),
  };
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetUrl(req: Request, token: string) {
  const baseUrl = getConfiguredBaseUrl() || getRequestBaseUrl(req);
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
