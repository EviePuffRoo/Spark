import { Router } from "express";
import { prisma } from "../db.js";
import { toChatMessageDTO } from "../serialize.js";
import { findAccessibleWorld, authorizeEntityWrite } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import { RECENT_HISTORY_LIMIT, REACTION_EMOJI } from "@spark/shared";
import type { ChatRoll } from "@spark/shared";

export const chatRouter = Router();

// Lenient validation of a client-posted DiceRoller snapshot — same "trust
// the shape, coerce what's reasonable" posture as this app's other
// coerce* helpers. Returns null (not persisted) on anything malformed
// rather than 400ing the whole message, since a message's text is valid
// on its own even if the roll payload riding along with it isn't.
function coerceRoll(raw: unknown): ChatRoll | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.notation !== "string" || !r.notation.trim()) return null;
  if (!Array.isArray(r.results) || !r.results.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (typeof r.modifier !== "number" || !Number.isFinite(r.modifier)) return null;
  if (typeof r.total !== "number" || !Number.isFinite(r.total)) return null;
  return {
    notation: r.notation,
    results: r.results as number[],
    modifier: r.modifier,
    total: r.total,
    label: typeof r.label === "string" && r.label.trim() ? r.label : undefined,
  };
}

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
  const { worldId, text, roll } = req.body ?? {};
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

  const coercedRoll = coerceRoll(roll);
  const row = await prisma.chatMessage.create({
    data: {
      worldId, userId: req.userId!, senderName: user.displayName || user.username, text: text.trim(),
      rollData: coercedRoll ? JSON.stringify(coercedRoll) : undefined,
    },
  });
  publishWorldChange(worldId, "chat");
  res.status(201).json(toChatMessageDTO(row));
});

// Toggles the caller in one emoji's reactor list — a small fixed set
// (REACTION_EMOJI) rather than free-form emoji, so no picker/validation
// library is needed. Reads-modify-writes the JSON blob rather than a
// relational table, same "flexible JSON column" convention as tags/notes
// elsewhere in this app — reaction counts on a single chat message are
// never large enough to need indexed storage.
chatRouter.post("/:id/react", async (req, res) => {
  const { emoji } = req.body ?? {};
  if (typeof emoji !== "string" || !(REACTION_EMOJI as readonly string[]).includes(emoji)) {
    return res.status(400).json({ error: "Unsupported reaction" });
  }

  const row = await prisma.chatMessage.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Message not found" });

  const world = await findAccessibleWorld(req.userId!, row.worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const reactions: Record<string, string[]> = JSON.parse(row.reactions ?? "{}");
  const reactors = reactions[emoji] ?? [];
  reactions[emoji] = reactors.includes(req.userId!)
    ? reactors.filter((id) => id !== req.userId!)
    : [...reactors, req.userId!];
  if (reactions[emoji].length === 0) delete reactions[emoji];

  const updated = await prisma.chatMessage.update({
    where: { id: req.params.id },
    data: { reactions: JSON.stringify(reactions) },
  });
  publishWorldChange(row.worldId, "chat");
  res.json(toChatMessageDTO(updated));
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
