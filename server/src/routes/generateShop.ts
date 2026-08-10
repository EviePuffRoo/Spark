import { Router } from "express";
import { generateShop } from "@spark/shared";
import type { GenerateShopRequest } from "@spark/shared";

export const generateShopRouter = Router();

generateShopRouter.post("/", (req, res) => {
  const request = (req.body ?? {}) as GenerateShopRequest;
  const generated = generateShop(request);
  res.json(generated);
});
