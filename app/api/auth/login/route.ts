export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getJwtExpiresDays,
  shouldUseSecureCookies,
  signAuthToken,
  type UserRole,
} from "@lib/auth";
import { dbQueryOne } from "@lib/mysql";
import { loginSchema } from "@lib/validatorsAuth";

type UserRow = RowDataPacket & {
  id: number;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  isBlocked: number | boolean;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await dbQueryOne<UserRow>(
      "SELECT `id`, `email`, `name`, `role`, `passwordHash`, `isBlocked` FROM `User` WHERE `email` = ? LIMIT 1",
      [email.toLowerCase()]
    );

    if (!user) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    if (user.isBlocked === true || user.isBlocked === 1) {
      return NextResponse.json({ ok: false, error: "USER_BLOCKED" }, { status: 403 });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const rawRole = user.role as string | undefined;
    const role: UserRole =
      rawRole === "SUPERADMIN" || rawRole === "ADMIN" || rawRole === "USER" ? rawRole : "USER";

    const token = await signAuthToken({
      sub: String(user.id),
      email: user.email,
      name: user.name ?? "",
      role,
    });

    cookies().set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      path: "/",
      maxAge: 60 * 60 * 24 * getJwtExpiresDays(),
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role },
    });
  } catch (e) {
    console.error("POST /api/auth/login error:", e);
    return NextResponse.json({ ok: false, error: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}
