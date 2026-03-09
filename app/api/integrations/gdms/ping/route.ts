import { NextResponse } from "next/server";
import { requireRequestAuthOrInternal } from "@lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@lib/rateLimit";
import { listAPsByNetwork, listNetworks } from "@services/gdms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "gdms-ping", {
      max: 4,
      windowMs: 5 * 60_000,
      key: "user" in auth ? auth.user.sub : `internal:${getClientIp(req)}`,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

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
  } catch (e) {
    console.error("GET /api/integrations/gdms/ping error:", e);
    return NextResponse.json({ ok: false, error: "GDMS_PING_FAILED" }, { status: 500 });
  }
}
