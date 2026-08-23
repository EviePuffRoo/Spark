import { Router } from "express";
import { SPELLS, CONDITIONS_COMPENDIUM, RULES_REFERENCE, MONSTER_TEMPLATES, MAGIC_ITEMS } from "@spark/shared";

export const compendiumRouter = Router();

compendiumRouter.get("/", (_req, res) => {
  res.json({
    spells: SPELLS,
    conditions: CONDITIONS_COMPENDIUM,
    rules: RULES_REFERENCE,
    monsters: MONSTER_TEMPLATES,
    magicItems: MAGIC_ITEMS,
  });
});
