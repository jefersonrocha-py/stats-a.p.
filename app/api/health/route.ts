export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, app: "up", db: "up" });
  } catch (e) {
    console.error("GET /api/health error:", e);
    return NextResponse.json({ ok: false, app: "up", db: "down" }, { status: 503 });
  }
}
