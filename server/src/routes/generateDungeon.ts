import { Router } from "express";
import { generateDungeonOutline } from "@spark/shared";
import type { GenerateDungeonRequest } from "@spark/shared";

export const generateDungeonRouter = Router();

generateDungeonRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateDungeonRequest;
  const generated = generateDungeonOutline(request);
  res.json(generated);
});
