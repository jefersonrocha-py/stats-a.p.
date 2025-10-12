// app/api/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyAuthToken } from "@/lib/auth";
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
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ ok: true, total: users.length, items: users });
  } catch (e: any) {
    console.error("GET /api/users error:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await verifyAuthToken(req);
    if (!me) return deny(401, "UNAUTHORIZED");
    if (me.role !== "SUPERADMIN") return deny();

    const json = await req.json();
    const parsed = createUserSchema.parse(json);

    const exists = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (exists) return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const created = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        passwordHash,
        role: parsed.role,
        isBlocked: false,
      },
      select: { id: true, name: true, email: true, role: true, isBlocked: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: "VALIDATION_FAILED", details: e.errors }, { status: 400 });
    }
    console.error("POST /api/users error:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
