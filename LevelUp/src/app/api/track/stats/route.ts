import { NextResponse } from "next/server";
import { prisma } from "@/app/api/_lib/prisma";

export async function GET() {
  const total = await prisma.marketingEvent.count({ where: { event: "enter_app_click" } });
  const last24h = await prisma.marketingEvent.count({
    where: { event: "enter_app_click", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return NextResponse.json({ enter_app_click: { total, last24h } });
}
