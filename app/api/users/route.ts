export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapUserRow } from "@lib/dbMappers";
import { mapDbError } from "@lib/dbErrors";
import { dbExecute, dbQuery, dbQueryOne } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";
import { strongPasswordSchema } from "@lib/validatorsAuth";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  password: strongPasswordSchema,
  role: z.enum(["USER", "ADMIN", "SUPERADMIN"]).optional().default("USER"),
});

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date | string;
  isBlocked: number | boolean;
  suspendedUntil: Date | string | null;
};

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const raw = await dbQuery<UserRow>(
      "SELECT `id`, `name`, `email`, `role`, `createdAt`, `isBlocked`, `suspendedUntil` FROM `User` ORDER BY `id` ASC"
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

    const rateLimit = checkRateLimit(req, "admin-create-user", {
      max: 20,
      windowMs: 60 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

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

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await dbExecute(
      "INSERT INTO `User` (`name`, `email`, `passwordHash`, `role`, `isBlocked`, `suspendedUntil`, `createdAt`) VALUES (?, ?, ?, ?, 0, NULL, ?)",
      [name, normalizedEmail, passwordHash, role, new Date()]
    );

    const item = await dbQueryOne<UserRow>(
      "SELECT `id`, `name`, `email`, `role`, `createdAt`, `isBlocked`, `suspendedUntil` FROM `User` WHERE `id` = ? LIMIT 1",
      [result.insertId]
    );

    return NextResponse.json({ ok: true, item: item ? mapUserRow(item) : null }, { status: 201 });
  } catch (e) {
    console.error("POST /api/users error:", e);
    const mapped = mapDbError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
