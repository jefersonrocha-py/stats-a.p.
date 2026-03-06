export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { prisma } from "@lib/prisma";
import { emit } from "@lib/sse";

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const idNum = Number(ctx.params.id);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const json = await req.json().catch(() => ({}));
    const lat = toNum(json.lat);
    const lon = toNum(json.lon);
    const description = typeof json.description === "string" ? json.description.trim() : undefined;

    const data: any = {};
    if (lat !== null) data.lat = lat;
    if (lon !== null) data.lon = lon;
    if (description !== undefined) data.description = description;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "NOTHING_TO_UPDATE" }, { status: 400 });
    }
    if ("lat" in data && (data.lat < -90 || data.lat > 90)) {
      return NextResponse.json({ ok: false, error: "INVALID_LAT" }, { status: 400 });
    }
    if ("lon" in data && (data.lon < -180 || data.lon > 180)) {
      return NextResponse.json({ ok: false, error: "INVALID_LON" }, { status: 400 });
    }

    const exists = await prisma.antenna.findUnique({ where: { id: idNum } });
    if (!exists) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const item = await prisma.antenna.update({ where: { id: idNum }, data });
    emit("antenna.updated", { id: idNum, kind: "coords" });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("PATCH /api/antennas/[id]/coords error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
