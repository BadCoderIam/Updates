import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try{
    const sets = await prisma.questionSet.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ sets });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try{
    const body = await req.json();
    const domain = body.domain || "NETWORKING";
    const name = body.name || "Networking Set";
    const status = body.status || "DRAFT";

    const set = await prisma.questionSet.create({
      data: { domain, name, status },
    });
    return NextResponse.json({ set });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
