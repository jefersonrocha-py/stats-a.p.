export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { prisma } from "@lib/prisma";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  role: z.enum(["USER", "ADMIN", "SUPERADMIN"]).optional().default("USER"),
});

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const raw = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        isBlocked: true,
      },
    });

    return NextResponse.json({ ok: true, total: raw.length, items: raw });
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

    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) {
      return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const item = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        isBlocked: true,
      },
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    console.error("POST /api/users error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
