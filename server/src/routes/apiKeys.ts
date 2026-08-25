import { Router } from "express";
import { prisma } from "../db.js";
import { generateApiKey } from "../publicApiAuth.js";

export const apiKeysRouter = Router();

function toApiKeySummary(row: { id: string; label: string; keyPrefix: string; enabled: boolean; createdAt: Date; lastUsedAt: Date | null }) {
  return {
    id: row.id,
    label: row.label,
    keyPrefix: row.keyPrefix,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

apiKeysRouter.get("/", async (req, res) => {
  const rows = await prisma.apiKey.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toApiKeySummary));
});

// Returns the raw key exactly once, alongside the same summary GET/list
// return — same one-time-reveal shape as a world's webhook secret. Never
// shown or reconstructable again after this response.
apiKeysRouter.post("/", async (req, res) => {
  const { label } = req.body ?? {};
  if (typeof label !== "string" || !label.trim()) {
    return res.status(400).json({ error: "label is required" });
  }

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  const row = await prisma.apiKey.create({
    data: { userId: req.userId!, label: label.trim(), keyHash, keyPrefix },
  });
  res.status(201).json({ ...toApiKeySummary(row), key: rawKey });
});

apiKeysRouter.delete("/:id", async (req, res) => {
  const result = await prisma.apiKey.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "API key not found" });
  res.status(204).end();
});
