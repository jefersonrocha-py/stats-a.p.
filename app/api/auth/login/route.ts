import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { loginSchema } from "../../../../lib/validatorsAuth.ts"; // <-- note o ".ts"
import bcrypt from "bcryptjs";
import { signAuthToken } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

    const token = await signAuthToken({
      sub: String(user.id),
      email: user.email,
      name: user.name,
      role: (user.role as any) || "USER",
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth", token, {
      httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: "VALIDATION_FAILED", details: e.errors }, { status: 400 });
    }
    console.error("POST /api/auth/login error:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
