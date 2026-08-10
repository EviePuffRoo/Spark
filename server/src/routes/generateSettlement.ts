import { Router } from "express";
import { generateSettlement } from "@spark/shared";
import type { GenerateSettlementRequest } from "@spark/shared";

export const generateSettlementRouter = Router();

generateSettlementRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateSettlementRequest;
  const generated = generateSettlement(request);
  res.json(generated);
});
