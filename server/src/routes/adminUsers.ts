import { Router } from "express";
import { prisma } from "../db.js";
import { requireAdmin } from "../adminAuth.js";
import { hashPassword, generateRecoveryCode, hashRecoveryCode } from "../auth.js";
import type { AdminUserSummary } from "@spark/shared";

// Admin-assisted account recovery: for a user who's lost their password,
// their recovery code, or both, and has verified their identity out of
// band (Discord, email, whatever channel already exists outside the app —
// there's no email field on User at all, so no in-app verification step
// exists here, same trust model as any other admin tool).
export const adminUsersRouter = Router();
adminUsersRouter.use(requireAdmin);

adminUsersRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json({ users: [] });

  const rows = await prisma.user.findMany({
    where: { username: { contains: q } },
    select: { id: true, username: true, tier: true, role: true, canPublish: true, createdAt: true },
    orderBy: { username: "asc" },
    take: 20,
  });
  const users: AdminUserSummary[] = rows.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
  res.json({ users });
});

// Re-arms the target user's own self-service recovery path without
// touching their password at all — the primary tool for "I lost my
// recovery code" without also being locked out of their account.
adminUsersRouter.post("/:id/recovery-code", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);
  await prisma.user.update({ where: { id: user.id }, data: { recoveryCodeHash } });
  res.json({ recoveryCode });
});

// For a fully locked-out user (lost both password and recovery code) — an
// explicit admin-chosen temporary password, not auto-generated, so they can
// log in and handle their own recovery code from Profile afterward.
adminUsersRouter.post("/:id/reset-password", async (req, res) => {
  const { newPassword } = req.body ?? {};
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.status(204).end();
});
