import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";

const issuer = "etherium";
const audience = "etherium-users";

export const AUTH_COOKIE_NAME = "auth";

export type UserRole = "SUPERADMIN" | "ADMIN" | "USER";

export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSecret() {
  return new TextEncoder().encode(getRequiredEnv("JWT_SECRET"));
}

export function getJwtExpiresDays() {
  const raw = Number(process.env.JWT_EXPIRES_DAYS ?? 7);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 7;
}

export function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
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

export function getAuthTokenFromRequest(req: Request) {
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length).trim();
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const authCookie = cookieHeader
    .split(/;\s*/)
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(`${AUTH_COOKIE_NAME}=`.length);

  return authCookie || null;
}

function deny(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function requireRequestAuth(req: Request, roles?: UserRole[]) {
  const token = getAuthTokenFromRequest(req);
  if (!token) return { response: deny(401, "UNAUTHORIZED") };

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
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  return req.headers.get("x-internal-api-key") === expected;
}

export async function requireRequestAuthOrInternal(req: Request, roles?: UserRole[]) {
  if (hasInternalApiKey(req)) return { internal: true as const };
  return requireRequestAuth(req, roles);
}
