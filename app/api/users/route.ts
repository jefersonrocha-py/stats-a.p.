// app/api/users/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@lib/prisma";
import bcrypt from "bcryptjs";
import { verifyAuthToken } from "@lib/auth";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  password: z.string().min(6).max(100),
  role: z.enum(["USER", "SUPERADMIN"]).optional().default("USER"),
});

function deny(status = 403, error = "FORBIDDEN") {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  try {
    const raw = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        // isBlocked: true, // ❌ deixe fora enquanto o Client do Docker não tem a coluna
      },
    });

    // Fallback de isBlocked para compatibilidade
    const items = raw.map((u: any) => ({
      ...u,
      isBlocked: Boolean(u?.isBlocked ?? false),
    }));

    return NextResponse.json({ ok: true, total: items.length, items });
  } catch (e) {
    console.error("GET /api/users error:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // ✅ Extrai token como string para o verifyAuthToken(token: string)
    const bearer = req.headers.get("authorization") || "";
    const headerToken = bearer.replace(/^Bearer\s+/i, "") || undefined;
    const cookieToken = cookies().get("auth")?.value || undefined;
    const token = headerToken ?? cookieToken;

    if (!token) return deny(401, "UNAUTHORIZED");

    const me = (await verifyAuthToken(token).catch(() => null)) as
      | { sub: string; email?: string; role?: string }
      | null;

    if (!me) return deny(401, "UNAUTHORIZED");
    if (me.role !== "SUPERADMIN") return deny();

    const json = await req.json().catch(() => ({}));
    const parsed = createUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        // isBlocked: false, // ❌ não grave enquanto o Client não tem
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        // isBlocked: true, // ❌ deixe fora
      },
    });

    const item = { ...created, isBlocked: false as boolean }; // fallback no JSON
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    console.error("POST /api/users error:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
