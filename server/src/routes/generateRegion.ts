import { Router } from "express";
import { generateRegion } from "@spark/shared";
import type { GenerateRegionRequest } from "@spark/shared";

export const generateRegionRouter = Router();

generateRegionRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateRegionRequest;
  const generated = generateRegion(request);
  res.json(generated);
});
