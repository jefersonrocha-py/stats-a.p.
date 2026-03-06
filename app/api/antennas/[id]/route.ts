export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapPrismaError } from "@lib/prismaErrors";
import { prisma } from "@lib/prisma";
import { emit } from "@lib/sse";
import { antennaUpdateSchema } from "@lib/validators";

const patchSchema = antennaUpdateSchema.pick({
  name: true,
  description: true,
  status: true,
});

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const auth = await requireRequestAuth(req);
  if ("response" in auth) return auth.response;

  const idNum = Number(ctx.params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const item = await prisma.antenna.findUnique({ where: { id: idNum } });
  if (!item) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const auth = await requireRequestAuth(req, ["ADMIN", "SUPERADMIN"]);
  if ("response" in auth) return auth.response;

  const idNum = Number(ctx.params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data: any = {};
  if (typeof parsed.data.name === "string") data.name = parsed.data.name.trim();
  if (typeof parsed.data.description === "string") {
    data.description = parsed.data.description.trim();
  }
  if (parsed.data.status) data.status = parsed.data.status;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  const before = await prisma.antenna.findUnique({
    where: { id: idNum },
    select: { id: true, status: true },
  });
  if (!before) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (data.status && data.status !== before.status) {
    data.lastStatusChange = new Date();
  }

  try {
    const item = await prisma.antenna.update({ where: { id: idNum }, data });

    if (data.status && data.status !== before.status) {
      await prisma.statusHistory.create({ data: { antennaId: idNum, status: data.status } });
      emit("status.changed", { id: idNum, status: data.status });
    } else {
      emit("antenna.updated", { id: idNum });
    }

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const mapped = mapPrismaError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const auth = await requireRequestAuth(req, ["ADMIN", "SUPERADMIN"]);
  if ("response" in auth) return auth.response;

  const idNum = Number(ctx.params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  try {
    const item = await prisma.antenna.delete({ where: { id: idNum } });
    emit("antenna.deleted", { id: idNum });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const mapped = mapPrismaError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
