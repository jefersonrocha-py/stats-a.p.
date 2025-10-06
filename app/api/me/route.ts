import { NextResponse } from "next/server";
import { verifyAuthToken } from "@lib/auth";

/** Retorna informações básicas do usuário autenticado (inclusive role). */
export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const authCookie = cookieHeader
      .split(/;\s*/)
      .find((c) => c.startsWith("auth="))
      ?.split("=")[1];

    if (!authCookie) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const me = await verifyAuthToken(authCookie);
    return NextResponse.json({
      ok: true,
      user: {
        id: me.sub,
        email: me.email,
        name: me.name,
        role: me.role,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
}
