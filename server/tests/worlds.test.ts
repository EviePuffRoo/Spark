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

describe("worlds nextSessionAt", () => {
  it("sets and clears nextSessionAt, reflected in the list and single-world responses", async () => {
    const { agent } = await signupAgent("worldowner1");
    const world = await agent.post("/api/worlds").send({ name: "Session World" });
    const worldId = world.body.id as string;

    const iso = new Date("2026-09-01T18:00:00.000Z").toISOString();
    const patched = await agent.patch(`/api/worlds/${worldId}`).send({ nextSessionAt: iso });
    expect(patched.status).toBe(200);
    expect(patched.body.nextSessionAt).toBe(iso);

    const single = await agent.get(`/api/worlds/${worldId}`);
    expect(single.body.nextSessionAt).toBe(iso);

    const list = await agent.get("/api/worlds");
    expect(list.body.find((w: { id: string }) => w.id === worldId).nextSessionAt).toBe(iso);

    const cleared = await agent.patch(`/api/worlds/${worldId}`).send({ nextSessionAt: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.nextSessionAt).toBeNull();
  });

  it("400s an unparseable nextSessionAt", async () => {
    const { agent } = await signupAgent("worldowner2");
    const world = await agent.post("/api/worlds").send({ name: "Bad Date World" });
    const worldId = world.body.id as string;

    const res = await agent.patch(`/api/worlds/${worldId}`).send({ nextSessionAt: "not a date" });
    expect(res.status).toBe(400);
  });

  it("shows a member the owner's scheduled session but doesn't let the member change it", async () => {
    const { agent: owner } = await signupAgent("worldowner3");
    const world = await owner.post("/api/worlds").send({ name: "Shared Session World" });
    const worldId = world.body.id as string;
    const joinCode = await owner.post(`/api/worlds/${worldId}/join-code`);

    const { agent: member } = await signupAgent("worldmember1");
    await member.post("/api/worlds/join").send({ code: joinCode.body.code });

    const iso = new Date("2026-09-05T20:00:00.000Z").toISOString();
    await owner.patch(`/api/worlds/${worldId}`).send({ nextSessionAt: iso });

    const list = await member.get("/api/worlds");
    expect(list.body.find((w: { id: string }) => w.id === worldId).nextSessionAt).toBe(iso);

    const memberPatch = await member.patch(`/api/worlds/${worldId}`).send({ nextSessionAt: null });
    expect(memberPatch.status).toBe(404);

    const stillSet = await owner.get(`/api/worlds/${worldId}`);
    expect(stillSet.body.nextSessionAt).toBe(iso);
  });
});
