import { NextResponse } from "next/server";
import { prisma } from "../../_lib/prisma";
import { ensureUser } from "../../_lib/ensureUser";

/**
 * Clears notifications for a user.
 * - If ids provided: marks those as read.
 * - If type provided: marks all of that type as read.
 * - If all=true: marks all as read.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? "");
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    const type = body?.type ? String(body.type) : null;
    const all = Boolean(body?.all);

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    await ensureUser(userId);

    const where: any = { userId };
    if (ids.length) where.id = { in: ids };
    if (type) where.type = type;
    if (!all && !ids.length && !type) {
      return NextResponse.json({ error: "Provide ids, type, or all=true" }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
