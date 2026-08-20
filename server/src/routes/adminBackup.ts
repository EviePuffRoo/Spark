import { Router } from "express";
import { requireAdmin } from "../adminAuth.js";
import { runDatabaseBackup } from "../dbBackup.js";

// Manual trigger for the same database backup the scheduled job runs —
// useful right before a risky deploy or migration, without waiting for
// the next scheduled window.
export const adminBackupRouter = Router();
adminBackupRouter.use(requireAdmin);

adminBackupRouter.post("/run", async (_req, res) => {
  const result = await runDatabaseBackup();
  if (result.status === "skipped") return res.status(503).json({ error: result.reason });
  res.json(result);
});
