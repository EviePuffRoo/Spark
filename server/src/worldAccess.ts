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

// Owner, or a member with the "coDM" role — the actual write-access check,
// as opposed to findAccessibleWorld's read/narrow-write check above. A
// "player" member can see everything in the world but can't write to it.
export async function canWriteWorld(userId: string, worldId: string): Promise<boolean> {
  const world = await prisma.world.findUnique({ where: { id: worldId } });
  if (!world) return false;
  if (world.userId === userId) return true;
  const membership = await prisma.worldMember.findUnique({ where: { worldId_userId: { worldId, userId } } });
  return membership?.role === "coDM";
}

// Authorizes writing to a row shaped like every per-world entity (its own
// creator's userId, plus a nullable worldId it's attached to): direct
// ownership always wins, otherwise coDM write access to the attached
// world. An entity with no worldId (never assigned to a world) stays
// owner-only, same as before this existed.
export async function authorizeEntityWrite(
  userId: string,
  row: { userId: string; worldId: string | null } | null,
): Promise<boolean> {
  if (!row) return false;
  if (row.userId === userId) return true;
  if (!row.worldId) return false;
  return canWriteWorld(userId, row.worldId);
}
