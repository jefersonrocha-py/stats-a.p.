import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuthToken } from "@lib/auth";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_FILE = /\.[^/]+$/;

function isPublic(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api")) return true;
  if (PUBLIC_FILE.test(pathname)) return true;
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth")?.value || null;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    if (pathname === "/login" && token) {
      try {
        await verifyAuthToken(token);
        return NextResponse.redirect(new URL("/", req.url));
      } catch {}
    }

    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const user = await verifyAuthToken(token);

    if (pathname.startsWith("/admin") && user.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (pathname.startsWith("/settings") && user.role === "USER") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
