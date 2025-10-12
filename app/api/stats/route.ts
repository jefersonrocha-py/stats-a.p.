// app/api/stats/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";

export async function GET() {
  try {
    // conte os status (ajuste para o seu schema se for diferente)
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
