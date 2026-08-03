import { Router } from "express";
import { generateItem } from "@spark/shared";
import type { GenerateItemRequest } from "@spark/shared";

export const generateItemRouter = Router();

generateItemRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateItemRequest;
  const generated = generateItem(request);
  res.json(generated);
});
