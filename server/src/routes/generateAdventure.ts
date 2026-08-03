import { Router } from "express";
import { composeAdventure } from "@spark/shared";
import type { GenerateAdventureRequest } from "@spark/shared";

export const generateAdventureRouter = Router();

generateAdventureRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateAdventureRequest;
  const generated = composeAdventure(request);
  res.json(generated);
});
