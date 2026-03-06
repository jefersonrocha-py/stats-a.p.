import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { prisma } from "@lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRequestAuth(req);
  if ("response" in auth) return auth.response;

  const antennaId = Number(params.id);
  if (!Number.isFinite(antennaId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

  const items = await prisma.statusHistory.findMany({
    where: { antennaId },
    orderBy: { changedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ ok: true, items });
}
