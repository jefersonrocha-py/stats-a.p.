export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@lib/prisma";
import { loginSchema } from "@lib/validatorsAuth";
import { signAuthToken } from "@lib/auth";
import bcrypt from "bcryptjs";

// union compatível com o que você usa no app
type RolePayload = "SUPERADMIN" | "ADMIN" | "USER";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        // isBlocked: true, // deixe comentado se o client do Prisma no Docker ainda não tipa
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const isBlocked = (user as any)?.isBlocked === true;
    if (isBlocked) {
      return NextResponse.json({ ok: false, error: "USER_BLOCKED" }, { status: 403 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    // normaliza role para o union esperado
    const rawRole = (user as any).role as string | undefined;
    const role: RolePayload =
      rawRole === "SUPERADMIN" || rawRole === "ADMIN" || rawRole === "USER" ? rawRole : "USER";

    // 👇 inclui name para satisfazer o JwtPayload exigido pelo signAuthToken
    const token = await signAuthToken({
      sub: String(user.id),
      email: user.email,
      name: user.name ?? "",      // <— adicionado
      role,
    });

    cookies().set({
      name: "auth",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * Number(process.env.JWT_EXPIRES_DAYS ?? 7),
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
