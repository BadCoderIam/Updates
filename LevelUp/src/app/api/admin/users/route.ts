import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(){
  try{
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        displayName: true,
        xp: true,
        startingPosition: true,
        moduleChoice: true,
        createdAt: true,
        lastActiveAt: true,
      }
    });
    return NextResponse.json({ users });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || "Failed to load users" }, { status: 500 });
  }
}

export async function PATCH(req: Request){
  try{
    const body = await req.json();
    const { id, xp, startingPosition, moduleChoice } = body || {};
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const data: any = {};
    if (typeof xp === "number") data.xp = xp;
    if (startingPosition) data.startingPosition = startingPosition;
    if (moduleChoice) data.moduleChoice = moduleChoice;

    const user = await prisma.user.update({ where: { id }, data });
    return NextResponse.json({ user });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || "Failed to update user" }, { status: 500 });
  }
}
