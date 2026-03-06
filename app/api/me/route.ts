import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";

export async function GET(req: Request) {
  const auth = await requireRequestAuth(req);
  if ("response" in auth) return auth.response;

  const me = auth.user;
  return NextResponse.json({
    ok: true,
    user: {
      id: me.sub,
      email: me.email,
      name: me.name,
      role: me.role,
    },
  });
}
