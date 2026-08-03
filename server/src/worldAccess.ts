import { prisma } from "./db.js";

export async function getMemberWorldIds(userId: string): Promise<string[]> {
  const rows = await prisma.worldMember.findMany({ where: { userId }, select: { worldId: true } });
  return rows.map((r) => r.worldId);
}
