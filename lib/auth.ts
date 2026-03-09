import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import {
  getCookieValue,
  isUnsafeMethod,
  requireCsrfToken,
  requireTrustedOrigin as requestRequiresTrustedOrigin,
} from "@lib/requestSecurity";

const issuer = "etherium";
const audience = "etherium-users";

export const AUTH_COOKIE_NAME = "auth";
export const CSRF_COOKIE_NAME = "csrf";

export type UserRole = "SUPERADMIN" | "ADMIN" | "USER";

export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
};

type CookieStoreLike = {
  set: (options: {
    name: string;
    value: string;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none";
    secure?: boolean;
    path?: string;
    maxAge?: number;
    priority?: "low" | "medium" | "high";
  }) => unknown;
};

function getRequiredEnv(name: string, minLength = 1) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  if (value.length < minLength) {
    throw new Error(`Environment variable ${name} must be at least ${minLength} characters long.`);
  }
  return value;
}

function getSecret() {
  return new TextEncoder().encode(getRequiredEnv("JWT_SECRET", 32));
}

export function getJwtExpiresDays() {
  const raw = Number(process.env.JWT_EXPIRES_DAYS ?? 7);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 7;
}

export function shouldUseSecureCookies() {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return false;
}

export function isAdminRole(role: UserRole | null | undefined) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export async function signAuthToken(payload: JwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(`${getJwtExpiresDays()}d`)
    .sign(getSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), { issuer, audience });
  return payload as unknown as JwtPayload;
}

function buildBaseCookieOptions(maxAge: number) {
  return {
    sameSite: "strict" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

function createCsrfToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function setAuthCookies(cookieStore: CookieStoreLike, authToken: string) {
  const maxAge = 60 * 60 * 24 * getJwtExpiresDays();
  const baseOptions = buildBaseCookieOptions(maxAge);

  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: authToken,
    httpOnly: true,
    ...baseOptions,
  });

  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: createCsrfToken(),
    httpOnly: false,
    ...baseOptions,
  });
}

export function clearAuthCookies(cookieStore: CookieStoreLike) {
  const baseOptions = buildBaseCookieOptions(0);

  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    ...baseOptions,
  });

  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: "",
    httpOnly: false,
    ...baseOptions,
  });
}

function getAuthTokenRecordFromRequest(req: Request) {
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return { token: bearer.slice("Bearer ".length).trim(), source: "bearer" as const };
  }

  const authCookie = getCookieValue(req, AUTH_COOKIE_NAME);
  if (authCookie) {
    return { token: authCookie, source: "cookie" as const };
  }

  return { token: null, source: null };
}

export function getAuthTokenFromRequest(req: Request) {
  return getAuthTokenRecordFromRequest(req).token;
}

export function requireTrustedOrigin(req: Request) {
  return requestRequiresTrustedOrigin(req);
}

export function requireCookieMutationProtection(req: Request) {
  if (!isUnsafeMethod(req.method)) return null;
  return requireCsrfToken(req, CSRF_COOKIE_NAME);
}

function deny(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

function constantTimeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

export async function requireRequestAuth(req: Request, roles?: UserRole[]) {
  const { token, source } = getAuthTokenRecordFromRequest(req);
  if (!token) return { response: deny(401, "UNAUTHORIZED") };

  if (source === "cookie" && isUnsafeMethod(req.method)) {
    const csrfError = requireCookieMutationProtection(req);
    if (csrfError) return { response: csrfError };
  }

  try {
    const user = await verifyAuthToken(token);
    if (roles?.length && !roles.includes(user.role)) {
      return { response: deny(403, "FORBIDDEN") };
    }
    return { user };
  } catch {
    return { response: deny(401, "UNAUTHORIZED") };
  }
}

export function hasInternalApiKey(req: Request) {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) return false;
  if (expected.length < 24) return false;

  const received = req.headers.get("x-internal-api-key")?.trim();
  if (!received) return false;
  return constantTimeEqual(received, expected);
}

export async function requireRequestAuthOrInternal(req: Request, roles?: UserRole[]) {
  if (hasInternalApiKey(req)) return { internal: true as const };
  return requireRequestAuth(req, roles);
}
