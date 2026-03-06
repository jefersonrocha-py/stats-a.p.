export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { prisma } from "@lib/prisma";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const [total, up, down] = await prisma.$transaction([
      prisma.antenna.count(),
      prisma.antenna.count({ where: { status: "UP" } }),
      prisma.antenna.count({ where: { status: "DOWN" } }),
    ]);

    return NextResponse.json(
      { ok: true, total, up, down },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("GET /api/stats error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
