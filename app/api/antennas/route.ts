export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapPrismaError } from "@lib/prismaErrors";
import { prisma } from "@lib/prisma";
import { emit } from "@lib/sse";
import { antennaCreateSchema } from "@lib/validators";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") as "UP" | "DOWN" | null) ?? null;
    const q = (searchParams.get("q") || "").trim();
    const unsaved = searchParams.get("unsaved");
    const placed = searchParams.get("placed");
    const takeParam = Number(searchParams.get("take") ?? 5000);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 10000) : 5000;

    const where: any = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { networkName: { contains: q, mode: "insensitive" } },
      ];
    }
    if (unsaved === "1") {
      where.lat = 0;
      where.lon = 0;
    }
    if (placed === "1") {
      where.AND = [
        { lat: { not: 0 } },
        { lon: { not: 0 } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      prisma.antenna.findMany({ where, orderBy: { id: "asc" }, take }),
      prisma.antenna.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      total: items.length,
      totalCount,
      items: items.map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() })),
    });
  } catch (e) {
    console.error("GET /api/antennas error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const json = await req.json().catch(() => ({}));
    const parsed = antennaCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const item = await prisma.antenna.create({
      data: {
        name: parsed.data.name.trim(),
        lat: parsed.data.lat,
        lon: parsed.data.lon,
        description: parsed.data.description?.trim() || null,
      },
    });

    await prisma.statusHistory.create({
      data: { antennaId: item.id, status: item.status },
    });
    emit("antenna.created", { id: item.id, status: item.status });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    console.error("POST /api/antennas error:", e);
    const mapped = mapPrismaError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
