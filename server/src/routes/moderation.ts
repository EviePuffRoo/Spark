import { Router } from "express";
import { prisma } from "../db.js";
import { requireAdmin } from "../adminAuth.js";
import { getAdapter } from "../entityAdapters.js";
import type { EntityType, GalleryReportDTO, ModerationQueueEntry } from "@spark/shared";

export const moderationRouter = Router();
moderationRouter.use(requireAdmin);

const PAGE_SIZE = 20;

moderationRouter.get("/reports", async (req, res) => {
  const { status, cursor } = req.query;
  const reportStatus = typeof status === "string" ? status : "pending";

  // Entries that have at least one report matching the status filter,
  // newest-published first — mirrors publicGallery.ts's own list/cursor shape.
  const entries = await prisma.publishedEntry.findMany({
    where: { reports: { some: { status: reportStatus } } },
    orderBy: { publishedAt: "desc" },
    ...(typeof cursor === "string" ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: PAGE_SIZE + 1,
    include: {
      user: { select: { username: true } },
      reports: {
        where: { status: reportStatus },
        orderBy: { createdAt: "desc" },
        include: { reporter: { select: { username: true } } },
      },
    },
  });

  const hasMore = entries.length > PAGE_SIZE;
  const page = entries.slice(0, PAGE_SIZE);

  const queue: ModerationQueueEntry[] = [];
  for (const entry of page) {
    const adapter = getAdapter(entry.entityType);
    // A source row deleted since publishing shouldn't hide it from the
    // queue the way it hides from the public gallery — an admin still
    // needs to see and resolve the reports against it.
    const sourceRow = adapter ? await adapter.findPublic(entry.entityId) : null;
    const reports: GalleryReportDTO[] = entry.reports.map((r) => ({
      id: r.id,
      reason: r.reason as GalleryReportDTO["reason"],
      detail: r.detail ?? undefined,
      status: r.status,
      reporterUsername: r.reporter.username,
      createdAt: r.createdAt.toISOString(),
    }));
    queue.push({
      id: entry.id,
      entityType: entry.entityType as EntityType,
      entityId: entry.entityId,
      title: entry.title,
      name: sourceRow && adapter ? adapter.getName(sourceRow) : "(source deleted)",
      publisherUsername: entry.user.username,
      publisherId: entry.userId,
      publishedAt: entry.publishedAt.toISOString(),
      reportCount: entry.reports.length,
      reports,
    });
  }

  res.json({ entries: queue, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null });
});

moderationRouter.post("/entries/:id/remove", async (req, res) => {
  const { reason } = req.body ?? {};
  if (typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "A removal reason is required" });
  }

  const entry = await prisma.publishedEntry.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: "Published entry not found" });

  await prisma.$transaction([
    prisma.publishedEntry.update({
      where: { id: entry.id },
      data: { removedAt: new Date(), removedReason: reason, removedByUserId: req.userId },
    }),
    prisma.galleryReport.updateMany({
      where: { entryId: entry.id, status: "pending" },
      data: { status: "actioned", resolvedAt: new Date(), resolvedByUserId: req.userId },
    }),
  ]);
  res.status(204).end();
});

moderationRouter.post("/reports/:id/dismiss", async (req, res) => {
  const result = await prisma.galleryReport.updateMany({
    where: { id: req.params.id, status: "pending" },
    data: { status: "dismissed", resolvedAt: new Date(), resolvedByUserId: req.userId },
  });
  if (result.count === 0) return res.status(404).json({ error: "Report not found" });
  res.status(204).end();
});

moderationRouter.post("/users/:id/suspend-publishing", async (req, res) => {
  const result = await prisma.user.updateMany({ where: { id: req.params.id }, data: { canPublish: false } });
  if (result.count === 0) return res.status(404).json({ error: "User not found" });
  res.status(204).end();
});

moderationRouter.post("/users/:id/restore-publishing", async (req, res) => {
  const result = await prisma.user.updateMany({ where: { id: req.params.id }, data: { canPublish: true } });
  if (result.count === 0) return res.status(404).json({ error: "User not found" });
  res.status(204).end();
});
