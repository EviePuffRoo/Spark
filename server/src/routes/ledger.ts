import { Router } from "express";
import { prisma } from "../db.js";
import { toLedgerEntryDTO, toPlayerCharacterDTO } from "../serialize.js";
import { findAccessibleWorld } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import type { LedgerItemTotal, LedgerSummary } from "@spark/shared";

export const ledgerRouter = Router();

ledgerRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const [goldAgg, itemRows, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { worldId, kind: "gold" }, _sum: { amount: true } }),
    prisma.ledgerEntry.findMany({ where: { worldId, kind: "item" } }),
    prisma.ledgerEntry.findMany({ where: { worldId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  // Grouped in application code rather than a Prisma groupBy, since the
  // grouping key itself varies per row: entries linked to a real Item
  // (itemId set) group by that id — so two different labels never
  // accidentally merge, and Claim always targets an unambiguous item —
  // while free-text entries with no Item behind them still group by
  // label exactly as before.
  const groups = new Map<string, LedgerItemTotal>();
  for (const row of itemRows) {
    const key = row.itemId ?? `label:${row.label}`;
    const existing = groups.get(key);
    if (existing) existing.quantity += row.amount;
    else groups.set(key, { label: row.label, quantity: row.amount, itemId: row.itemId ?? undefined });
  }
  const items = [...groups.values()].filter((i) => i.quantity > 0).sort((a, b) => a.label.localeCompare(b.label));

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
  const { worldId, kind, label, amount, authorName, itemId } = body;

  if (
    typeof worldId !== "string" ||
    (kind !== "gold" && kind !== "item") ||
    typeof label !== "string" || !label.trim() ||
    typeof amount !== "number" || !Number.isFinite(amount) || Math.trunc(amount) === 0 ||
    typeof authorName !== "string" || !authorName.trim() ||
    (itemId !== undefined && typeof itemId !== "string")
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
      itemId: kind === "item" && typeof itemId === "string" ? itemId : undefined,
    },
  });
  publishWorldChange(worldId, "ledger");
  res.status(201).json(toLedgerEntryDTO(row));
});

ledgerRouter.post("/claim", async (req, res) => {
  const { worldId, itemId, playerCharacterId } = req.body ?? {};
  if (typeof worldId !== "string" || typeof itemId !== "string" || typeof playerCharacterId !== "string") {
    return res.status(400).json({ error: "worldId, itemId, and playerCharacterId are required" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const pc = await prisma.playerCharacter.findFirst({ where: { id: playerCharacterId, userId: req.userId } });
  if (!pc) return res.status(404).json({ error: "Player character not found" });
  if (pc.worldId !== worldId) {
    return res.status(400).json({ error: "That character isn't assigned to this world" });
  }

  const agg = await prisma.ledgerEntry.aggregate({ where: { worldId, kind: "item", itemId }, _sum: { amount: true } });
  const available = agg._sum.amount ?? 0;
  if (available <= 0) return res.status(400).json({ error: "None of this item remains in the party inventory" });

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  const label = item?.name ?? "Item";
  const equippedItems: string[] = JSON.parse(pc.equippedItems);

  await prisma.$transaction([
    prisma.ledgerEntry.create({
      data: { worldId, kind: "item", label, amount: -1, itemId, authorName: pc.name, userId: req.userId! },
    }),
    prisma.playerCharacter.update({
      where: { id: pc.id },
      data: { equippedItems: JSON.stringify([...new Set([...equippedItems, itemId])]) },
    }),
  ]);
  publishWorldChange(worldId, "ledger");

  const updatedPc = await prisma.playerCharacter.findUnique({ where: { id: pc.id } });
  res.json(toPlayerCharacterDTO(updatedPc!));
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
