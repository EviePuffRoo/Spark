import { Router } from "express";
import { generateLocation } from "@spark/shared";
import type { GenerateLocationRequest } from "@spark/shared";

export const generateLocationRouter = Router();

generateLocationRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateLocationRequest;
  const generated = generateLocation(request);
  res.json(generated);
});
