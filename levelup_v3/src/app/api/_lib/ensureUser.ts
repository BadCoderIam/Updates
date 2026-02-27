import { prisma } from "./prisma";

/**
 * In demo/local mode, the app may call APIs with a userId that doesn't exist yet.
 * This helper makes the APIs resilient by upserting a minimal user row.
 */
export async function ensureUser(userId: string) {
  if (!userId) throw new Error("Missing userId");
  const email = userId.includes("@") ? userId : `${userId}@local.leveluppro`;
  const displayName = userId;

  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email,
      displayName,
      xp: 0,      lootGrantedUpToLevel: 0,
      rank: "STUDENT",
    },
  });
}
