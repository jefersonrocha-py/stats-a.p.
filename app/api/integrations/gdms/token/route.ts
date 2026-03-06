import { NextResponse } from "next/server";
import { requireRequestAuthOrInternal } from "@lib/auth";
import { forceRefresh, getTokenInfo } from "@lib/gdmsToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const info = await getTokenInfo();
    return NextResponse.json({ ok: true, ...info });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rec = await forceRefresh();
    return NextResponse.json({ ok: true, expiresAt: rec.expiresAt });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
