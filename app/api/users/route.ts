import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";
import { registerSchema } from "@lib/validatorsAuth";
import bcrypt from "bcryptjs";
import { verifyAuthToken } from "@lib/auth";

async function requireSuperAdmin(req: Request) {
  const cookie = (req as any).cookies?.get?.("auth")?.value
    || (req.headers.get("cookie") || "").split(/;\s*/).find(c => c.startsWith("auth="))?.split("=")[1]
    || null;
  if (!cookie) return null;
  try {
    const payload = await verifyAuthToken(cookie);
    return payload?.role === "SUPERADMIN" ? payload : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const me = await requireSuperAdmin(req);
  if (!me) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json({ ok: true, items: users });
}

export async function POST(req: Request) {
  const me = await requireSuperAdmin(req);
  if (!me) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const json = await req.json();
    const data = registerSchema.parse(json);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const created = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, role: (json.role || "USER").toUpperCase() },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
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
