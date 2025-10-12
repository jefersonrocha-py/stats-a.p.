// app/api/register/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

// ✅ Por padrão, auto-registro desabilitado
const ALLOW = process.env.ALLOW_SELF_REGISTER === "true";

export async function POST(req: Request) {
  if (!ALLOW) {
    return NextResponse.json(
      { ok: false, error: "REGISTER_DISABLED" },
      { status: 405 }
    );
  }

  // Quando habilitado via ALLOW_SELF_REGISTER=true, cria o usuário e NÃO loga automaticamente.
  // Login continua pelo /api/auth/login.
  try {
    const { registerSchema } = await import("../../../lib/validatorsAuth");
    const { prisma } = await import("../../../lib/prisma");
    const { mapPrismaError } = await import("../../../lib/prismaErrors");
    const bcrypt = (await import("bcryptjs")).default;

    const body = await req.json().catch(() => ({}));
    const { name, email, password } = registerSchema.parse(body);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: String(email).toLowerCase(),
        passwordHash,
        // role: "USER", // se seu schema tiver default já não precisa
      },
      select: { id: true, name: true, email: true, /* role: true */ },
    });

    // ❌ Não gera token aqui (evita dependência de signAuthToken e mantém política de login explícito)
    return NextResponse.json(
      { ok: true, user },
      { status: 201 }
    );
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: e.errors },
        { status: 400 }
      );
    }
    // mapPrismaError pode não existir em todos os projetos; se não tiver, remova esse bloco e retorne 500 genérico
    try {
      const { mapPrismaError } = await import("../../../lib/prismaErrors");
      const mapped = mapPrismaError(e);
      return NextResponse.json(mapped.body, { status: mapped.status });
    } catch {
      return NextResponse.json(
        { ok: false, error: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  }
}
