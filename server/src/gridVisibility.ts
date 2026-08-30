import { prisma } from "./db.js";
import { computeVisionForTokens, extendWithLightSources } from "@spark/shared";
import type { LiveCombatant, PlacedTile } from "@spark/shared";

// Fog of war / dynamic lighting is a paid feature, gated on the world
// owner's tier — same rule as Home Base (base.ts) and every other
// campaign-automation gate: one DM's subscription runs the whole table.
// A free-tier-owned world simply never computes vision, so every viewer
// (owner and non-owner alike) keeps seeing full visibility, exactly like
// the app behaved before fog of war existed.
async function worldOwnerHasFogAccess(worldOwnerId: string): Promise<boolean> {
  const owner = await prisma.user.findUnique({ where: { id: worldOwnerId }, select: { tier: true } });
  return owner?.tier === "paid";
}

// The party's current-instant vision, if a battle map is active — null
// when it isn't (or the owning world's tier doesn't unlock fog), meaning
// "no grid fog concept applies right now." Shared by the write paths in
// encounters.ts (to grow exploredCells) and the read paths (encounters
// GET, worldLive's sendEncounter) that need it to redact non-owner
// combatants outside current sight.
export async function computeCurrentVisibility(activeBattleMapId: string | null, combatants: LiveCombatant[], worldOwnerId: string, openDoors?: Set<string>): Promise<Set<string> | null> {
  if (!activeBattleMapId) return null;
  if (!(await worldOwnerHasFogAccess(worldOwnerId))) return null;
  const map = await prisma.battleMap.findUnique({ where: { id: activeBattleMapId } });
  if (!map) return null;
  const tiles: PlacedTile[] = JSON.parse(map.tiles);
  const mapShape = { width: map.width, height: map.height, tiles };
  return extendWithLightSources(mapShape, computeVisionForTokens(mapShape, combatants, openDoors), combatants, openDoors);
}
