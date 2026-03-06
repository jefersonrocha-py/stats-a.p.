export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { pingDb } from "@lib/mysql";

export async function GET() {
  try {
    await pingDb();
    return NextResponse.json({ ok: true, app: "up", db: "up" });
  } catch (e) {
    console.error("GET /api/health error:", e);
    return NextResponse.json({ ok: false, app: "up", db: "down" }, { status: 503 });
  }
}
