import { Router } from "express";
import { RACES, BACKGROUNDS, ALIGNMENTS, NPC_TEMPLATES, MONSTER_TEMPLATES, ITEM_CATEGORIES, ITEM_RARITY_TIERS } from "@spark/shared";

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
  });
});
