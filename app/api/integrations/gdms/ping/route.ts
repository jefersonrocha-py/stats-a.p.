import { NextResponse } from "next/server";
import { requireRequestAuthOrInternal } from "@lib/auth";
import { listAPsByNetwork, listNetworks } from "@services/gdms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const networks = await listNetworks();
    const perNetwork: Array<{ id: string; name: string; aps: number }> = [];
    let totalAps = 0;

    for (const network of networks) {
      const aps = await listAPsByNetwork(network.id, network.networkName ?? "");
      perNetwork.push({ id: network.id, name: network.networkName ?? "", aps: aps.length });
      totalAps += aps.length;
    }

    return NextResponse.json({
      ok: true,
      networks: networks.length,
      totalAps,
      perNetwork: perNetwork.slice(0, 20),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
