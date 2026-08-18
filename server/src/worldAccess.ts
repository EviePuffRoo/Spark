import { prisma } from "./db.js";

// "Member" here means anyone with standing access to the world — a joined
// WorldMember row, or the world's owner. A world's owner never gets their
// own WorldMember row (there's no self-join step at world-creation time),
// so without unioning owned worlds in here, every downstream query that
// scopes by "worldId in memberWorldIds" (search, per-world entity listing,
// exports, links, ...) would silently miss entities other users saved into
// a world the caller owns but never joined as a member of.
export async function getMemberWorldIds(userId: string): Promise<string[]> {
  const [memberRows, ownedRows] = await Promise.all([
    prisma.worldMember.findMany({ where: { userId }, select: { worldId: true } }),
    prisma.world.findMany({ where: { userId }, select: { id: true } }),
  ]);
  return [...new Set([...memberRows.map((r) => r.worldId), ...ownedRows.map((r) => r.id)])];
}

// Owner or member — the "can view / narrow-write" access check shared by
// encounters, ledger, roll log, and the live SSE channel. Full-write
// operations (e.g. PUT /encounters/:worldId) additionally require checking
// world.userId === userId themselves; this only establishes read/narrow access.
export async function findAccessibleWorld(userId: string, worldId: string) {
  const memberWorldIds = await getMemberWorldIds(userId);
  return prisma.world.findFirst({ where: { id: worldId, OR: [{ userId }, { id: { in: memberWorldIds } }] } });
}
