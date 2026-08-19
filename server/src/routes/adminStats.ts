import { Router } from "express";
import { prisma } from "../db.js";
import { requireAdmin } from "../adminAuth.js";
import { STARTER_WORLD_NAME } from "../seedStarterWorld.js";
import type { AdminStats } from "@spark/shared";

export const adminStatsRouter = Router();
adminStatsRouter.use(requireAdmin);

adminStatsRouter.get("/", async (_req, res) => {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, paidUsers, signupsLast7Days, signupsLast30Days,
    totalWorlds, starterWorldsCreated,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { tier: "paid" } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.world.count(),
    // Approximate, not exact — a user could rename or delete this world,
    // or coincidentally create one with the same name themselves. See
    // seedStarterWorld.ts for why this specific name is a reasonable signal.
    prisma.world.count({ where: { name: STARTER_WORLD_NAME } }),
  ]);

  const stats: AdminStats = {
    totalUsers,
    freeUsers: totalUsers - paidUsers,
    paidUsers,
    signupsLast7Days,
    signupsLast30Days,
    totalWorlds,
    starterWorldsCreated,
  };
  res.json(stats);
});
