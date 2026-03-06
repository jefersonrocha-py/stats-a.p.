export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { prisma } from "@lib/prisma";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const rows = await prisma.antenna.findMany({
      where: { networkName: { not: null } },
      distinct: ["networkName"],
      select: { networkName: true },
      orderBy: { networkName: "asc" },
    });

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => row.networkName?.trim() ?? "").filter(Boolean),
    });
  } catch (e) {
    console.error("GET /api/antennas/networks error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
