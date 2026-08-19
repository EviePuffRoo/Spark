import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { resetDb } from "./resetDb.js";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

async function signupAgent(username: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({ username, password: "password123" });
  return { agent, userId: res.body.id as string };
}

describe("admin stats", () => {
  it("rejects a non-admin account", async () => {
    const { agent } = await signupAgent("regularuser1");
    const res = await agent.get("/api/admin/stats");
    expect(res.status).toBe(403);
  });

  it("reports correct aggregate counts", async () => {
    // vitest.config.ts sets ADMIN_USERNAMES=admintestuser — auth.ts promotes
    // this account to admin on signup, same as auth.test.ts relies on.
    const { agent: admin } = await signupAgent("admintestuser");

    const { userId: paidUserId } = await signupAgent("paiduser1");
    await prisma.user.update({ where: { id: paidUserId }, data: { tier: "paid" } });
    await signupAgent("freeuser1");

    await admin.post("/api/worlds").send({ name: "A Regular World" });
    // Matches STARTER_WORLD_NAME in seedStarterWorld.ts exactly — a real
    // starter-world seed would also produce a world with this name.
    await admin.post("/api/worlds").send({ name: "The Salt Coast" });

    const res = await admin.get("/api/admin/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(3);
    expect(res.body.paidUsers).toBe(1);
    expect(res.body.freeUsers).toBe(2);
    expect(res.body.signupsLast7Days).toBe(3);
    expect(res.body.signupsLast30Days).toBe(3);
    expect(res.body.totalWorlds).toBe(2);
    expect(res.body.starterWorldsCreated).toBe(1);
  });
});
