import { Router } from "express";
import { prisma } from "../db.js";
import { toChatMessageDTO } from "../serialize.js";
import { findAccessibleWorld } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";

export const chatRouter = Router();

chatRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.chatMessage.findMany({
    where: { worldId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json(rows.map(toChatMessageDTO));
});

chatRouter.post("/", async (req, res) => {
  const { worldId, text } = req.body ?? {};
  if (!worldId || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "worldId and a non-empty message are required" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  // senderName is the poster's own account identity (display name if set,
  // else username), not client-supplied — chat is an identity-bound
  // conversation, unlike the roll log's client-chosen rollerName label.
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: "Not signed in" });

  const row = await prisma.chatMessage.create({
    data: { worldId, userId: req.userId!, senderName: user.displayName || user.username, text: text.trim() },
  });
  publishWorldChange(worldId, "chat");
  res.status(201).json(toChatMessageDTO(row));
});

chatRouter.delete("/:id", async (req, res) => {
  const row = await prisma.chatMessage.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Message not found" });

  const world = await prisma.world.findUnique({ where: { id: row.worldId } });
  const canDelete = row.userId === req.userId || world?.userId === req.userId;
  if (!canDelete) return res.status(403).json({ error: "You can't delete this message" });

  await prisma.chatMessage.delete({ where: { id: req.params.id } });
  publishWorldChange(row.worldId, "chat");
  res.status(204).end();
});
