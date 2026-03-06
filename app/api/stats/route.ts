export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { dbQueryOne } from "@lib/mysql";

type StatsRow = RowDataPacket & {
  total: number;
  up: number | null;
  down: number | null;
};

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const stats = await dbQueryOne<StatsRow>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN \`status\` = 'UP' THEN 1 ELSE 0 END) AS up,
         SUM(CASE WHEN \`status\` = 'DOWN' THEN 1 ELSE 0 END) AS down
       FROM \`Antenna\``
    );

    return NextResponse.json(
      {
        ok: true,
        total: Number(stats?.total ?? 0),
        up: Number(stats?.up ?? 0),
        down: Number(stats?.down ?? 0),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("GET /api/stats error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
