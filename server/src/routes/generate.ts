import { Router } from "express";
import { generateCharacter } from "@spark/shared";
import type { GenerateRequest } from "@spark/shared";

export const generateRouter = Router();

generateRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateRequest;
  const generated = generateCharacter(request);
  res.json(generated);
});
