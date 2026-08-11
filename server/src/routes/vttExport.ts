import { Router } from "express";
import { prisma } from "../db.js";
import { getMemberWorldIds } from "../worldAccess.js";
import type { AbilityScores } from "@spark/shared";

export const vttExportRouter = Router();

// Converts D&D challenge rating notation ("1/8", "1/4", "1/2", "5") into the
// decimal Foundry's dnd5e system expects for system.details.cr.
function crToNumber(cr: string): number {
  if (cr.includes("/")) {
    const [num, den] = cr.split("/").map(Number);
    return den ? num / den : 0;
  }
  return Number(cr) || 0;
}

function abilitiesBlock(scores: AbilityScores) {
  return {
    str: { value: scores.str },
    dex: { value: scores.dex },
    con: { value: scores.con },
    int: { value: scores.int },
    wis: { value: scores.wis },
    cha: { value: scores.cha },
  };
}

// Minimal Foundry VTT dnd5e Actor document — stat block only (name, type,
// AC, HP, abilities, CR for NPCs). No embedded items/spells/inventory;
// system.attributes.ac uses calc:"flat" since an imported actor with no
// armor items would otherwise have its AC recomputed to 10 by the system's
// default calculation.
function buildFoundryActor(name: string, type: "npc" | "character", ac: number, hp: number, abilityScores: AbilityScores, cr?: string) {
  return {
    name,
    type,
    img: "icons/svg/mystery-man.svg",
    system: {
      abilities: abilitiesBlock(abilityScores),
      attributes: {
        ac: { flat: ac, calc: "flat" },
        hp: { value: hp, max: hp },
      },
      ...(cr !== undefined ? { details: { cr: crToNumber(cr) } } : {}),
    },
    items: [],
  };
}

vttExportRouter.get("/characters/:id/export/foundry", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.character.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Character not found" });

  const statBlock = JSON.parse(row.statBlock);
  const actor = buildFoundryActor(row.name, "npc", statBlock.armorClass, statBlock.hitPointsAverage, statBlock.abilityScores, statBlock.challengeRating);
  res.json(actor);
});

vttExportRouter.get("/player-characters/:id/export/foundry", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.playerCharacter.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Player character not found" });

  const abilityScores = JSON.parse(row.abilityScores);
  const actor = buildFoundryActor(row.name, "character", row.armorClass, row.maxHp, abilityScores);
  res.json(actor);
});
