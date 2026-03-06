export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { listConnectedClientsByNetwork } from "@services/gdms";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const items = await listConnectedClientsByNetwork();
    const totalClients = items.reduce((sum, item) => sum + item.clients, 0);

    return NextResponse.json(
      {
        ok: true,
        totalNetworks: items.length,
        totalClients,
        items,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("GET /api/stats/network-clients error:", e);
    return NextResponse.json({ ok: false, error: "GDMS_CLIENT_STATS_ERROR" }, { status: 500 });
  }
}
