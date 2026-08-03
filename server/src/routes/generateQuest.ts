import { Router } from "express";
import { generateQuestHook } from "@spark/shared";
import type { GenerateQuestHookRequest } from "@spark/shared";

export const generateQuestRouter = Router();

generateQuestRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateQuestHookRequest;
  const generated = generateQuestHook(request);
  res.json(generated);
});
