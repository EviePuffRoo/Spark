import { Router } from "express";
import { SPELLS, CONDITIONS_COMPENDIUM, RULES_REFERENCE } from "@spark/shared";

export const compendiumRouter = Router();

compendiumRouter.get("/", (_req, res) => {
  res.json({
    spells: SPELLS,
    conditions: CONDITIONS_COMPENDIUM,
    rules: RULES_REFERENCE,
  });
});
