export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { dbQuery } from "@lib/mysql";

type NetworkRow = RowDataPacket & { networkName: string | null };

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const rows = await dbQuery<NetworkRow>(
      "SELECT DISTINCT TRIM(`networkName`) AS `networkName` FROM `Antenna` WHERE `networkName` IS NOT NULL AND TRIM(`networkName`) <> '' ORDER BY TRIM(`networkName`) ASC"
    );

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => row.networkName?.trim() ?? "").filter(Boolean),
    });
  } catch (e) {
    console.error("GET /api/antennas/networks error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
