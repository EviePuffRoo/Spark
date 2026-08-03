import { Router } from "express";
import { buildExport, applyImport, type ExportBundle } from "../backup.js";

export const backupRouter = Router();

backupRouter.get("/export", async (req, res) => {
  const worldId = typeof req.query.worldId === "string" ? req.query.worldId : undefined;
  const bundle = await buildExport(worldId);
  res.json(bundle);
});

backupRouter.post("/import", async (req, res) => {
  const bundle = req.body as ExportBundle;
  if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.worlds)) {
    return res.status(400).json({ error: "This doesn't look like a valid Spark backup file." });
  }
  try {
    const result = await applyImport(bundle);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: `Failed to import backup: ${(e as Error).message}` });
  }
});
