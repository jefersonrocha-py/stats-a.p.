export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapAntennaRow } from "@lib/dbMappers";
import { mapDbError } from "@lib/dbErrors";
import { dbExecute, dbQuery, dbQueryOne, withTransaction } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";
import { emit } from "@lib/sse";
import { antennaCreateSchema } from "@lib/validators";

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

type CountRow = RowDataPacket & { totalCount: number };

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") as "UP" | "DOWN" | null) ?? null;
    const q = (searchParams.get("q") || "").trim();
    const network = (searchParams.get("network") || "").trim();
    const unsaved = searchParams.get("unsaved");
    const placed = searchParams.get("placed");
    const pageParam = Number(searchParams.get("page") ?? 1);
    const pageSizeParam = Number(searchParams.get("pageSize") ?? searchParams.get("take") ?? 5000);
    const page = Number.isFinite(pageParam) ? Math.max(1, Math.floor(pageParam)) : 1;
    const pageSize = Number.isFinite(pageSizeParam)
      ? Math.min(Math.max(Math.floor(pageSizeParam), 1), 10000)
      : 5000;

    const whereClauses: string[] = [];
    const whereParams: Array<string | number> = [];

    if (status) {
      whereClauses.push("`status` = ?");
      whereParams.push(status);
    }
    if (network) {
      whereClauses.push("`networkName` = ?");
      whereParams.push(network);
    }
    if (q) {
      whereClauses.push("(`name` LIKE ? OR `networkName` LIKE ?)");
      const like = `%${q}%`;
      whereParams.push(like, like);
    }
    if (unsaved === "1") {
      whereClauses.push("`lat` = 0 AND `lon` = 0");
    }
    if (placed === "1") {
      whereClauses.push("`lat` <> 0 AND `lon` <> 0");
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countRow = await dbQueryOne<CountRow>(
      `SELECT COUNT(*) AS totalCount FROM \`Antenna\` ${whereSql}`,
      whereParams
    );

    const totalCount = Number(countRow?.totalCount ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * pageSize;

    const items = await dbQuery<AntennaRow>(
      `SELECT * FROM \`Antenna\` ${whereSql} ORDER BY \`id\` ASC LIMIT ${pageSize} OFFSET ${skip}`,
      whereParams
    );

    return NextResponse.json({
      ok: true,
      total: items.length,
      totalCount,
      page: currentPage,
      pageSize,
      totalPages,
      items: items.map(mapAntennaRow),
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

    const rateLimit = checkRateLimit(req, "antenna-create", {
      max: 60,
      windowMs: 15 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const json = await req.json().catch(() => ({}));
    const parsed = antennaCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const now = new Date();
    const item = await withTransaction(async (connection) => {
      const result = await dbExecute(
        "INSERT INTO `Antenna` (`name`, `lat`, `lon`, `description`, `status`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, 'DOWN', ?, ?)",
        [
          parsed.data.name.trim(),
          parsed.data.lat,
          parsed.data.lon,
          parsed.data.description?.trim() || null,
          now,
          now,
        ],
        connection
      );

      await dbExecute(
        "INSERT INTO `StatusHistory` (`antennaId`, `status`, `changedAt`) VALUES (?, 'DOWN', ?)",
        [result.insertId, now],
        connection
      );

      const row = await dbQueryOne<AntennaRow>(
        "SELECT * FROM `Antenna` WHERE `id` = ? LIMIT 1",
        [result.insertId],
        connection
      );

      if (!row) {
        throw new Error("CREATED_ANTENNA_NOT_FOUND");
      }

      return row;
    });

    emit("antenna.created", { id: item.id, status: item.status });

    return NextResponse.json({ ok: true, item: mapAntennaRow(item) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/antennas error:", e);
    const mapped = mapDbError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
