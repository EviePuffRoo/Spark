import { Router } from "express";
import { prisma } from "../db.js";
import { toLedgerEntryDTO } from "../serialize.js";
import { findAccessibleWorld } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import type { LedgerSummary } from "@spark/shared";

export const ledgerRouter = Router();

ledgerRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const [goldAgg, itemGroups, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { worldId, kind: "gold" }, _sum: { amount: true } }),
    prisma.ledgerEntry.groupBy({ by: ["label"], where: { worldId, kind: "item" }, _sum: { amount: true } }),
    prisma.ledgerEntry.findMany({ where: { worldId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const items = itemGroups
    .map((g) => ({ label: g.label, quantity: g._sum.amount ?? 0 }))
    .filter((i) => i.quantity > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  const summary: LedgerSummary = {
    worldId,
    gold: goldAgg._sum.amount ?? 0,
    items,
    entries: entries.map(toLedgerEntryDTO),
  };
  res.json(summary);
});

ledgerRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, kind, label, amount, authorName } = body;

  if (
    typeof worldId !== "string" ||
    (kind !== "gold" && kind !== "item") ||
    typeof label !== "string" || !label.trim() ||
    typeof amount !== "number" || !Number.isFinite(amount) || Math.trunc(amount) === 0 ||
    typeof authorName !== "string" || !authorName.trim()
  ) {
    return res.status(400).json({ error: "Missing or invalid ledger entry fields" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const row = await prisma.ledgerEntry.create({
    data: {
      worldId,
      kind,
      label: label.trim(),
      amount: Math.trunc(amount),
      authorName: authorName.trim(),
      userId: req.userId!,
    },
  });
  publishWorldChange(worldId, "ledger");
  res.status(201).json(toLedgerEntryDTO(row));
});

ledgerRouter.delete("/:id", async (req, res) => {
  const row = await prisma.ledgerEntry.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Ledger entry not found" });

  const world = await prisma.world.findUnique({ where: { id: row.worldId } });
  const canDelete = row.userId === req.userId || world?.userId === req.userId;
  if (!canDelete) return res.status(403).json({ error: "You can't delete this ledger entry" });

  await prisma.ledgerEntry.delete({ where: { id: req.params.id } });
  publishWorldChange(row.worldId, "ledger");
  res.status(204).end();
});
