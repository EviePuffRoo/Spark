import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword, signToken, setSessionCookie, clearSessionCookie, requireAuth } from "../auth.js";
import type { AuthUser } from "@spark/shared";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function toAuthUser(user: { id: string; username: string }): AuthUser {
  return { id: user.id, username: user.username };
}

authRouter.post("/signup", authLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string" || username.trim().length < 3 || password.length < 8) {
    return res.status(400).json({ error: "Username must be at least 3 characters and password at least 8 characters." });
  }

  const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (existing) return res.status(409).json({ error: "That username is already taken." });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { username: username.trim(), passwordHash } });

  setSessionCookie(res, signToken(user.id));
  res.status(201).json(toAuthUser(user));
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
