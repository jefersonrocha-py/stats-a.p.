import { NextResponse } from "next/server";
import { requireRequestAuthOrInternal } from "@lib/auth";
import { forceRefresh, getTokenInfo } from "@lib/gdmsToken";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const info = await getTokenInfo();
    return NextResponse.json({ ok: true, ...info });
  } catch (e) {
    console.error("GET /api/integrations/gdms/token error:", e);
    return NextResponse.json({ ok: false, error: "GDMS_TOKEN_INFO_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "gdms-token-refresh", {
      max: 4,
      windowMs: 15 * 60_000,
      key: "user" in auth ? auth.user.sub : `internal:${getClientIp(req)}`,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const rec = await forceRefresh();
    return NextResponse.json({ ok: true, expiresAt: rec.expiresAt });
  } catch (e) {
    console.error("POST /api/integrations/gdms/token error:", e);
    return NextResponse.json({ ok: false, error: "GDMS_TOKEN_REFRESH_FAILED" }, { status: 500 });
  }
}
