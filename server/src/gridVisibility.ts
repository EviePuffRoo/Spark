import { prisma } from "./db.js";
import { computeVisionForTokens, extendWithLightSources } from "@spark/shared";
import type { LiveCombatant, PlacedTile } from "@spark/shared";

// The party's current-instant vision, if a battle map is active — null
// when it isn't, meaning "no grid fog concept applies right now." Shared
// by the write paths in encounters.ts (to grow exploredCells) and the
// read paths (encounters GET, worldLive's sendEncounter) that need it to
// redact non-owner combatants outside current sight.
export async function computeCurrentVisibility(activeBattleMapId: string | null, combatants: LiveCombatant[]): Promise<Set<string> | null> {
  if (!activeBattleMapId) return null;
  const map = await prisma.battleMap.findUnique({ where: { id: activeBattleMapId } });
  if (!map) return null;
  const tiles: PlacedTile[] = JSON.parse(map.tiles);
  const mapShape = { width: map.width, height: map.height, tiles };
  return extendWithLightSources(mapShape, computeVisionForTokens(mapShape, combatants), combatants);
}
