import { Router } from "express";
import { generatePlayerCharacter } from "@spark/shared";
import type { GeneratePlayerCharacterRequest } from "@spark/shared";

export const generatePlayerCharacterRouter = Router();

generatePlayerCharacterRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GeneratePlayerCharacterRequest;
  const generated = generatePlayerCharacter(request);
  res.json(generated);
});
