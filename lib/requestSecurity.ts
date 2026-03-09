import "server-only";

import { NextResponse } from "next/server";

export function isUnsafeMethod(method?: string) {
  const normalized = (method ?? "GET").toUpperCase();
  return !["GET", "HEAD", "OPTIONS"].includes(normalized);
}

export function getCookieValue(req: Request, name: string) {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(/;\s*/)
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(`${name}=`.length);

  return cookie ? decodeURIComponent(cookie) : null;
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function getExpectedOrigins(req: Request) {
  const origins = new Set<string>();
  const requestOrigin = normalizeOrigin(req.url);
  if (requestOrigin) origins.add(requestOrigin);

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto && forwardedHost) {
    origins.add(`${forwardedProto}://${forwardedHost}`.toLowerCase());
  }

  const host = req.headers.get("host")?.trim();
  if (host) {
    if (forwardedProto) {
      origins.add(`${forwardedProto}://${host}`.toLowerCase());
    }
    if (requestOrigin) {
      const requestProtocol = new URL(requestOrigin).protocol;
      origins.add(`${requestProtocol}//${host}`.toLowerCase());
    }
  }

  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const appOrigin = normalizeOrigin(appUrl);
    if (appOrigin) origins.add(appOrigin);
  }

  return origins;
}

function matchesRequestOrigin(req: Request, candidate: string) {
  const candidateOrigin = normalizeOrigin(candidate);
  if (!candidateOrigin) return false;
  return getExpectedOrigins(req).has(candidateOrigin);
}

function deny(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export function requireTrustedOrigin(req: Request) {
  if (!isUnsafeMethod(req.method)) return null;

  const origin = req.headers.get("origin");
  if (origin) {
    return matchesRequestOrigin(req, origin) ? null : deny(403, "ORIGIN_MISMATCH");
  }

  const referer = req.headers.get("referer");
  if (referer) {
    return matchesRequestOrigin(req, referer) ? null : deny(403, "ORIGIN_MISMATCH");
  }

  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return null;
  }

  return deny(403, "ORIGIN_REQUIRED");
}

export function requireCsrfToken(req: Request, cookieName: string) {
  const originError = requireTrustedOrigin(req);
  if (originError) return originError;

  const headerToken = req.headers.get("x-csrf-token")?.trim() || "";
  const cookieToken = getCookieValue(req, cookieName) || "";

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return deny(403, "CSRF_INVALID");
  }

  return null;
}
