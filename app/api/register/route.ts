export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { mapPrismaError } from "@lib/prismaErrors";
import { prisma } from "@lib/prisma";
import { registerSchema } from "@lib/validatorsAuth";

const ALLOW = process.env.ALLOW_SELF_REGISTER === "true";

export async function POST(req: Request) {
  if (!ALLOW) {
    return NextResponse.json({ ok: false, error: "REGISTER_DISABLED" }, { status: 405 });
  }

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
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: e.errors },
        { status: 400 }
      );
    }

    const mapped = mapPrismaError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
