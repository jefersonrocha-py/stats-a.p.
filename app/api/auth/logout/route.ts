export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearAuthCookies, getAuthTokenFromRequest, requireCookieMutationProtection, requireTrustedOrigin } from "@lib/auth";

export function POST(req: Request) {
  const hasSession = Boolean(getAuthTokenFromRequest(req));
  if (hasSession) {
    const csrfError = requireCookieMutationProtection(req);
    if (csrfError) return csrfError;
  } else {
    const originError = requireTrustedOrigin(req);
    if (originError) return originError;
  }

  clearAuthCookies(cookies());

  return NextResponse.json({ ok: true });
}
