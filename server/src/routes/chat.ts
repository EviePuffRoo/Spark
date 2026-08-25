import { Router } from "express";
import { prisma } from "../db.js";
import { toChatMessageDTO } from "../serialize.js";
import { findAccessibleWorld, authorizeEntityWrite } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import { RECENT_HISTORY_LIMIT } from "@spark/shared";

export const chatRouter = Router();

chatRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  // Fetches the most recent RECENT_HISTORY_LIMIT by descending createdAt,
  // then reverses to the ascending display order the live view renders —
  // "most recent N" and "oldest first" pull in opposite directions once a
  // world has more messages than the window, so ordering after take() (not
  // before it) is what actually gets the newest window of messages.
  const rows = await prisma.chatMessage.findMany({
    where: { worldId },
    orderBy: { createdAt: "desc" },
    take: RECENT_HISTORY_LIMIT,
  });
  res.json(rows.reverse().map(toChatMessageDTO));
});

// Paid-only: paging back further than the live view's most-recent window.
// Never touched by the live SSE channel (worldLive.ts) — see the identical
// note on rollLogRouter's /history handler.
chatRouter.get("/history", async (req, res) => {
  const { worldId, before } = req.query;
  if (typeof worldId !== "string" || typeof before !== "string") {
    return res.status(400).json({ error: "worldId and before are required" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { tier: true } });
  if (user?.tier !== "paid") {
    return res.status(403).json({ error: "Full history is a paid feature — upgrade to browse past this point.", code: "history_paid_only" });
  }

  // Deliberately NOT reversed to ascending like the live route — this
  // section renders separately from the live list (see the client-side
  // ordering note in ChatPanel.tsx), and staying in descending order lets
  // each subsequent "Load More" page append to the end while the whole
  // section stays monotonically ordered (newest-of-the-old first).
  const rows = await prisma.chatMessage.findMany({
    where: { worldId },
    orderBy: { createdAt: "desc" },
    cursor: { id: before },
    skip: 1,
    take: 50,
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

  if (!(await authorizeEntityWrite(req.userId!, row))) {
    return res.status(403).json({ error: "You can't delete this message" });
  }

  await prisma.chatMessage.delete({ where: { id: req.params.id } });
  publishWorldChange(row.worldId, "chat");
  res.status(204).end();
});
