import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db.js";

// Mounted after requireAuth, same layering as every other route-specific
// check in this app (e.g. billing's stripe-configured guard) — req.userId
// is already set by the time this runs.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
  if (user?.role !== "admin") return res.status(403).json({ error: "Admins only" });
  next();
}
