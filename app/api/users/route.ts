export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapUserRow } from "@lib/dbMappers";
import { mapDbError } from "@lib/dbErrors";
import { dbExecute, dbQuery, dbQueryOne } from "@lib/mysql";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  role: z.enum(["USER", "ADMIN", "SUPERADMIN"]).optional().default("USER"),
});

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date | string;
  isBlocked: number | boolean;
};

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const raw = await dbQuery<UserRow>(
      "SELECT `id`, `name`, `email`, `role`, `createdAt`, `isBlocked` FROM `User` ORDER BY `id` ASC"
    );

    return NextResponse.json({ ok: true, total: raw.length, items: raw.map(mapUserRow) });
  } catch (e) {
    console.error("GET /api/users error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const json = await req.json().catch(() => ({}));
    const parsed = createUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const exists = await dbQueryOne<UserRow>(
      "SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1",
      [normalizedEmail]
    );
    if (exists) {
      return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await dbExecute(
      "INSERT INTO `User` (`name`, `email`, `passwordHash`, `role`, `isBlocked`, `createdAt`) VALUES (?, ?, ?, ?, 0, ?)",
      [name, normalizedEmail, passwordHash, role, new Date()]
    );

    const item = await dbQueryOne<UserRow>(
      "SELECT `id`, `name`, `email`, `role`, `createdAt`, `isBlocked` FROM `User` WHERE `id` = ? LIMIT 1",
      [result.insertId]
    );

    return NextResponse.json({ ok: true, item: item ? mapUserRow(item) : null }, { status: 201 });
  } catch (e) {
    console.error("POST /api/users error:", e);
    const mapped = mapDbError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
