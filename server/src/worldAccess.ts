import { prisma } from "./db.js";

// The single definition of "a world this user can reach": they own it, or
// they hold a WorldMember row on it. A world's owner never gets their own
// WorldMember row (there's no self-join step at world-creation time), so
// the owner arm is not redundant — without it, every query that scopes by
// world membership (search, per-world entity listing, exports, links, ...)
// would silently miss entities other users saved into a world the caller
// owns but never joined as a member of.
//
// Expressed once here as a Prisma filter fragment so the rule lives in one
// place: the three helpers below all reuse it rather than restating it,
// and each resolves in a single query instead of enumerating every
// reachable world id first and then filtering against that list in JS.
function reachableWorldWhere(userId: string) {
  return { OR: [{ userId }, { members: { some: { userId } } }] };
}

// Every world id the user can reach. Callers pass the result to
// visibleEntityWhere/listVisibleWhere below to scope an entity query.
export async function getMemberWorldIds(userId: string): Promise<string[]> {
  const rows = await prisma.world.findMany({
    where: reachableWorldWhere(userId),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// Owner or member — the "can view / narrow-write" access check shared by
// encounters, ledger, roll log, and the live SSE channel. Full-write
// operations (e.g. PUT /encounters/:worldId) additionally require checking
// world.userId === userId themselves; this only establishes read/narrow access.
export async function findAccessibleWorld(userId: string, worldId: string) {
  return prisma.world.findFirst({ where: { id: worldId, ...reachableWorldWhere(userId) } });
}

// Owner, or a member with the "coDM" role — the actual write-access check,
// as opposed to findAccessibleWorld's read/narrow-write check above. A
// "player" member can see everything in the world but can't write to it.
// Asked as a single existence query rather than fetching the world and then
// its membership row: selecting a relation instead makes Prisma issue a
// second SELECT for it, which is the thing this is avoiding.
export async function canWriteWorld(userId: string, worldId: string): Promise<boolean> {
  const writable = await prisma.world.findFirst({
    where: { id: worldId, OR: [{ userId }, { members: { some: { userId, role: "coDM" } } }] },
    select: { id: true },
  });
  return writable !== null;
}

// The visibility rule every per-world entity shares: your own rows always,
// plus rows sitting in a world you can reach that the DM hasn't marked
// hidden. Kept here rather than restated per route so a change to what
// "visible" means lands everywhere at once, and so a new entity type gets
// the rule right by construction.
export function visibleEntityWhere(userId: string, memberWorldIds: string[]) {
  return { OR: [{ userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] };
}

// Translates the `?worldId=` query param the entity list routes accept into
// a Prisma filter fragment: "unassigned" means rows attached to no world,
// a world id means that world, anything else means don't filter by world.
export function worldScopeWhere(worldId: unknown) {
  if (worldId === "unassigned") return { worldId: null };
  if (typeof worldId === "string") return { worldId };
  return {};
}

// The exact shape every entity list route needs — visibility plus the
// optional world scope — so those routes are one call rather than a
// hand-rolled OR clause each.
export function listVisibleWhere(userId: string, memberWorldIds: string[], worldId: unknown) {
  return { ...visibleEntityWhere(userId, memberWorldIds), ...worldScopeWhere(worldId) };
}

// The world-owner-tier gate shared by every paid campaign-automation
// feature (Trigger Rules, Doom Clock, Autonomous Wars, World Tick) — same
// rule as Home Base's own inline check (base.ts): the DM's subscription,
// not the acting member's, is what unlocks a feature for the whole table.
export async function worldOwnerIsPaid(worldOwnerId: string): Promise<boolean> {
  const owner = await prisma.user.findUnique({ where: { id: worldOwnerId }, select: { tier: true } });
  return owner?.tier === "paid";
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
