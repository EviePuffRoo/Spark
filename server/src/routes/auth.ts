import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import {
  hashPassword, verifyPassword, signToken, setSessionCookie, clearSessionCookie, requireAuth,
  generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode,
} from "../auth.js";
import type { AuthUser, SignupResult, RecoveryCodeResult } from "@spark/shared";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts — please wait a few minutes and try again." },
});

function toAuthUser(user: { id: string; username: string; plan: string }): AuthUser {
  return { id: user.id, username: user.username, plan: user.plan === "pro" ? "pro" : "free" };
}

authRouter.post("/signup", authLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string" || username.trim().length < 3 || password.length < 8) {
    return res.status(400).json({ error: "Username must be at least 3 characters and password at least 8 characters." });
  }

  const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (existing) return res.status(409).json({ error: "That username is already taken." });

  const passwordHash = await hashPassword(password);
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);
  const user = await prisma.user.create({ data: { username: username.trim(), passwordHash, recoveryCodeHash } });

  setSessionCookie(res, signToken(user.id));
  const result: SignupResult = { ...toAuthUser(user), recoveryCode };
  res.status(201).json(result);
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  setSessionCookie(res, signToken(user.id));
  res.json(toAuthUser(user));
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Not signed in" });
  res.json(toAuthUser(user));
});

// Placeholder self-serve plan toggle — no real payment yet. A Stripe webhook
// can later call this exact update with zero changes to how gating works.
authRouter.post("/plan", requireAuth, async (req, res) => {
  const { plan } = req.body ?? {};
  if (plan !== "free" && plan !== "pro") {
    return res.status(400).json({ error: "Plan must be \"free\" or \"pro\"." });
  }
  const user = await prisma.user.update({ where: { id: req.userId }, data: { plan } });
  res.json(toAuthUser(user));
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.status(204).end();
});

// Generates (or replaces) the signed-in user's recovery code. Useful both for
// accounts created before this feature existed and for anyone who lost their code.
authRouter.post("/recovery-code", requireAuth, async (req, res) => {
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);
  await prisma.user.update({ where: { id: req.userId }, data: { recoveryCodeHash } });
  const result: RecoveryCodeResult = { recoveryCode };
  res.json(result);
});

authRouter.post("/reset-password", authLimiter, async (req, res) => {
  const { username, recoveryCode, newPassword } = req.body ?? {};
  if (typeof username !== "string" || typeof recoveryCode !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "Username, recovery code, and a new password (8+ characters) are required." });
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user?.recoveryCodeHash || !(await verifyRecoveryCode(recoveryCode, user.recoveryCodeHash))) {
    return res.status(401).json({ error: "That username and recovery code don't match." });
  }

  const passwordHash = await hashPassword(newPassword);
  const nextRecoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(nextRecoveryCode);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, recoveryCodeHash } });

  setSessionCookie(res, signToken(user.id));
  const result: SignupResult = { ...toAuthUser(user), recoveryCode: nextRecoveryCode };
  res.json(result);
});
