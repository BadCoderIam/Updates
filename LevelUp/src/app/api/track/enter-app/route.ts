import { NextResponse } from "next/server";
import { prisma } from "@/app/api/_lib/prisma";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    const h = await headers();
    const ua = h.get("user-agent") || undefined;
    const xff = h.get("x-forwarded-for") || undefined;
    const ip = xff ? xff.split(",")[0].trim() : undefined;

    let body: any = null;
    try { body = await req.json(); } catch {}

    const source = body?.source ? String(body.source) : undefined;
    const path = body?.path ? String(body.path) : undefined;

    await prisma.marketingEvent.create({
      data: {
        event: "enter_app_click",
        source,
        path,
        userAgent: ua,
        ip,
        meta: body?.meta ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Never block UX for analytics
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
