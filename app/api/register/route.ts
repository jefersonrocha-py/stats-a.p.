export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";
import { registerSchema } from "@lib/validatorsAuth";
import { mapPrismaError } from "@lib/prismaErrors";
import { signAuthToken } from "@lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, password } = registerSchema.parse(body);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    const token = await signAuthToken({ sub: String(user.id), email: user.email });

    const maxAgeDays = Number(process.env.JWT_EXPIRES_DAYS ?? 7);
    const res = NextResponse.json(
      { ok: true, user: { id: user.id, name: user.name, email: user.email } },
      { status: 201 }
    );

    res.cookies.set({
      name: "auth",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * maxAgeDays,
    });

    return res;
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: "VALIDATION_FAILED", details: e.errors }, { status: 400 });
    }
    const mapped = mapPrismaError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
