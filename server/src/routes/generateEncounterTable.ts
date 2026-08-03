import { Router } from "express";
import { generateEncounterTable } from "@spark/shared";
import type { GenerateEncounterTableRequest } from "@spark/shared";

export const generateEncounterTableRouter = Router();

generateEncounterTableRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateEncounterTableRequest;
  const generated = generateEncounterTable(request);
  res.json(generated);
});
