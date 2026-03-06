export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapAntennaRow } from "@lib/dbMappers";
import { dbExecute, dbQueryOne } from "@lib/mysql";
import { emit } from "@lib/sse";

type AntennaRow = RowDataPacket & {
  id: number;
  name: string;
  description: string | null;
  lat: number;
  lon: number;
  status: string;
  gdmsApId: string | null;
  networkId: string | null;
  networkName: string | null;
  lastSyncAt: Date | string | null;
  lastStatusChange: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

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

    const assignments: string[] = [];
    const values: Array<number | string | Date> = [];

    if (lat !== null) {
      assignments.push("`lat` = ?");
      values.push(lat);
    }
    if (lon !== null) {
      assignments.push("`lon` = ?");
      values.push(lon);
    }
    if (description !== undefined) {
      assignments.push("`description` = ?");
      values.push(description);
    }

    if (!assignments.length) {
      return NextResponse.json({ ok: false, error: "NOTHING_TO_UPDATE" }, { status: 400 });
    }
    if (lat !== null && (lat < -90 || lat > 90)) {
      return NextResponse.json({ ok: false, error: "INVALID_LAT" }, { status: 400 });
    }
    if (lon !== null && (lon < -180 || lon > 180)) {
      return NextResponse.json({ ok: false, error: "INVALID_LON" }, { status: 400 });
    }

    const exists = await dbQueryOne<AntennaRow>(
      "SELECT * FROM `Antenna` WHERE `id` = ? LIMIT 1",
      [idNum]
    );
    if (!exists) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    assignments.push("`updatedAt` = ?");
    values.push(new Date());
    values.push(idNum);

    await dbExecute(
      `UPDATE \`Antenna\` SET ${assignments.join(", ")} WHERE \`id\` = ?`,
      values
    );

    const item = await dbQueryOne<AntennaRow>(
      "SELECT * FROM `Antenna` WHERE `id` = ? LIMIT 1",
      [idNum]
    );

    emit("antenna.updated", { id: idNum, kind: "coords" });

    return NextResponse.json({ ok: true, item: item ? mapAntennaRow(item) : null });
  } catch (e) {
    console.error("PATCH /api/antennas/[id]/coords error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
