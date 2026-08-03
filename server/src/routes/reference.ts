import { Router } from "express";
import {
  RACES, BACKGROUNDS, ALIGNMENTS, NPC_TEMPLATES, MONSTER_TEMPLATES,
  ITEM_CATEGORIES, ITEM_RARITY_TIERS, LOCATION_CATEGORIES, QUEST_TYPES, QUEST_TIERS,
  FACTION_TYPES, ENCOUNTER_TERRAINS,
} from "@spark/shared";

export const referenceRouter = Router();

referenceRouter.get("/", (_req, res) => {
  res.json({
    races: RACES,
    backgrounds: BACKGROUNDS,
    alignments: ALIGNMENTS,
    npcTemplates: NPC_TEMPLATES.map(({ id, name, challengeRating, typicalAlignment }) => ({ id, name, challengeRating, typicalAlignment })),
    monsterTemplates: MONSTER_TEMPLATES.map(({ id, name, challengeRating, typicalAlignment }) => ({ id, name, challengeRating, typicalAlignment })),
    itemCategories: ITEM_CATEGORIES,
    itemRarities: ITEM_RARITY_TIERS,
    locationCategories: LOCATION_CATEGORIES,
    questTypes: QUEST_TYPES,
    questTiers: QUEST_TIERS,
    factionTypes: FACTION_TYPES,
    encounterTerrains: ENCOUNTER_TERRAINS,
  });
});
