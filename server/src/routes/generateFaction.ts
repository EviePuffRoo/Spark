import { Router } from "express";
import { generateFaction } from "@spark/shared";
import type { GenerateFactionRequest } from "@spark/shared";

export const generateFactionRouter = Router();

generateFactionRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateFactionRequest;
  const generated = generateFaction(request);
  res.json(generated);
});
