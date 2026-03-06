import { NextResponse } from "next/server";
import { requireRequestAuthOrInternal } from "@lib/auth";
import { prisma } from "@lib/prisma";
import { listAPsByNetwork, listNetworks } from "@services/gdms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const statusOnly = searchParams.get("mode") === "status";
    const networks = await listNetworks();
    const now = new Date();

    let created = 0;
    let updated = 0;
    let statusChanged = 0;
    let totalFetched = 0;
    const perNetwork: Array<{ id: string; name: string; fetched: number }> = [];
    const errors: Array<{ apId: string; reason: string }> = [];

    for (const network of networks) {
      const aps = await listAPsByNetwork(network.id, network.networkName ?? "");
      perNetwork.push({ id: network.id, name: network.networkName ?? "", fetched: aps.length });
      totalFetched += aps.length;

      for (const ap of aps) {
        try {
          const existing = await prisma.antenna.findFirst({
            where: { gdmsApId: ap.apId },
            select: { id: true, status: true, lat: true, lon: true },
          });

          if (statusOnly) {
            if (!existing) continue;
            const statusChangedNow = existing.status !== ap.status;
            await prisma.antenna.update({
              where: { gdmsApId: ap.apId },
              data: {
                status: ap.status,
                lastSyncAt: now,
                ...(statusChangedNow ? { lastStatusChange: now } : {}),
              },
            });
            updated++;
            if (statusChangedNow) {
              await prisma.statusHistory.create({ data: { antennaId: existing.id, status: ap.status } });
              statusChanged++;
            }
            continue;
          }

          const base: any = {
            name: ap.apName,
            networkId: ap.networkId,
            networkName: ap.networkName,
            status: ap.status,
            lastSyncAt: now,
          };

          if (existing && existing.lat === 0 && existing.lon === 0) {
            if (typeof ap.lat === "number") base.lat = ap.lat;
            if (typeof ap.lng === "number") base.lon = ap.lng;
          }

          if (!existing) {
            const createdRow = await prisma.antenna.create({
              data: {
                gdmsApId: ap.apId,
                ...base,
                lat: typeof base.lat === "number" ? base.lat : 0,
                lon: typeof base.lon === "number" ? base.lon : 0,
              },
            });
            await prisma.statusHistory.create({ data: { antennaId: createdRow.id, status: ap.status } });
            created++;
            continue;
          }

          const statusChangedNow = existing.status !== ap.status;
          await prisma.antenna.update({
            where: { gdmsApId: ap.apId },
            data: {
              ...base,
              ...(statusChangedNow ? { lastStatusChange: now } : {}),
            },
          });
          if (statusChangedNow) {
            await prisma.statusHistory.create({ data: { antennaId: existing.id, status: ap.status } });
            statusChanged++;
          }
          updated++;
        } catch (rowErr: any) {
          errors.push({ apId: ap.apId, reason: rowErr?.message ?? String(rowErr) });
        }
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      mode: statusOnly ? "status" : "full",
      networks: networks.length,
      totalFetched,
      created,
      updated,
      statusChanged,
      perNetwork,
      errors: errors.slice(0, 50),
      at: now.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
