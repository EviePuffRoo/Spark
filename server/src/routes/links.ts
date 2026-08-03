import { Router } from "express";
import { prisma } from "../db.js";
import { getAdapter, isEntityType } from "../entityAdapters.js";
import type { EntityLink } from "@spark/shared";

export const linksRouter = Router();

linksRouter.get("/", async (req, res) => {
  const { type, id } = req.query;
  if (typeof type !== "string" || typeof id !== "string" || !isEntityType(type)) {
    return res.status(400).json({ error: "type and id query params are required" });
  }

  const rows = await prisma.link.findMany({
    where: { userId: req.userId, OR: [{ fromType: type, fromId: id }, { toType: type, toId: id }] },
    orderBy: { createdAt: "desc" },
  });

  const resolved: EntityLink[] = await Promise.all(
    rows.map(async (link) => {
      const isFrom = link.fromType === type && link.fromId === id;
      const otherType = isFrom ? link.toType : link.fromType;
      const otherId = isFrom ? link.toId : link.fromId;
      const adapter = getAdapter(otherType);
      const otherRow = adapter ? await adapter.findUnique(otherId, req.userId!) : null;

      return {
        id: link.id,
        label: link.label ?? undefined,
        other: {
          type: otherType as EntityLink["other"]["type"],
          id: otherId,
          name: otherRow && adapter ? adapter.getName(otherRow) : "(deleted)",
        },
      };
    })
  );

  res.json(resolved);
});

linksRouter.post("/", async (req, res) => {
  const { fromType, fromId, toType, toId, label } = req.body ?? {};

  if (!isEntityType(fromType) || !isEntityType(toType) || !fromId || !toId) {
    return res.status(400).json({ error: "fromType, fromId, toType, toId are required" });
  }
  if (fromType === toType && fromId === toId) {
    return res.status(400).json({ error: "Cannot link an entry to itself" });
  }

  const fromAdapter = getAdapter(fromType);
  const toAdapter = getAdapter(toType);
  const [fromRow, toRow] = await Promise.all([
    fromAdapter!.findUnique(fromId, req.userId!),
    toAdapter!.findUnique(toId, req.userId!),
  ]);
  if (!fromRow || !toRow) {
    return res.status(404).json({ error: "One or both entries could not be found" });
  }

  const row = await prisma.link.create({
    data: { fromType, fromId, toType, toId, label: label || null, userId: req.userId! },
  });
  res.status(201).json(row);
});

linksRouter.delete("/:id", async (req, res) => {
  const result = await prisma.link.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Link not found" });
  res.status(204).end();
});
