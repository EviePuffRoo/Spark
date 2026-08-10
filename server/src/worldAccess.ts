import { prisma } from "./db.js";

export async function getMemberWorldIds(userId: string): Promise<string[]> {
  const rows = await prisma.worldMember.findMany({ where: { userId }, select: { worldId: true } });
  return rows.map((r) => r.worldId);
}

// Owner or member — the "can view / narrow-write" access check shared by
// encounters, ledger, roll log, and the live SSE channel. Full-write
// operations (e.g. PUT /encounters/:worldId) additionally require checking
// world.userId === userId themselves; this only establishes read/narrow access.
export async function findAccessibleWorld(userId: string, worldId: string) {
  const memberWorldIds = await getMemberWorldIds(userId);
  return prisma.world.findFirst({ where: { id: worldId, OR: [{ userId }, { id: { in: memberWorldIds } }] } });
}
