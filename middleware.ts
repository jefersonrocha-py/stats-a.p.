// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
];

function isPublic(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  // IMPORTANTE: trate toda /api como pública (deixe a API se autenticar por si)
  if (pathname.startsWith("/api")) return true;
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth")?.value || null;

  // 0) Bypass explícito para /api (defesa em profundidade)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // 1) Páginas públicas
  if (isPublic(pathname)) {
    // se já logado, evita voltar pra /login ou /register
    if ((pathname === "/login" || pathname === "/register") && token) {
      try {
        await jwtVerify(token, secret);
        return NextResponse.redirect(new URL("/", req.url));
      } catch {}
    }
    return NextResponse.next();
  }

  // 2) Páginas protegidas
  if (!token) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
}

// Não “matchear” /api
export const config = {
  matcher: ["/((?!api|_next|favicon.ico|assets).*)"],
};
