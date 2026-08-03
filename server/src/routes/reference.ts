import { Router } from "express";
import { RACES, BACKGROUNDS, ALIGNMENTS, NPC_TEMPLATES, MONSTER_TEMPLATES } from "@spark/shared";

export const referenceRouter = Router();

referenceRouter.get("/", (_req, res) => {
  res.json({
    races: RACES,
    backgrounds: BACKGROUNDS,
    alignments: ALIGNMENTS,
    npcTemplates: NPC_TEMPLATES.map(({ id, name, challengeRating, typicalAlignment }) => ({ id, name, challengeRating, typicalAlignment })),
    monsterTemplates: MONSTER_TEMPLATES.map(({ id, name, challengeRating, typicalAlignment }) => ({ id, name, challengeRating, typicalAlignment })),
  });
});
