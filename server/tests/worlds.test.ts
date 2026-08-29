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

describe("world house rules", () => {
  it("defaults to an empty object for a new world", async () => {
    const { agent } = await signupAgent("houserulesowner1");
    const world = await agent.post("/api/worlds").send({ name: "House Rules World" });
    expect(world.body.houseRules).toEqual({});

    const single = await agent.get(`/api/worlds/${world.body.id}`);
    expect(single.body.houseRules).toEqual({});
  });

  it("sets house rules, reflected in the list and single-world responses", async () => {
    const { agent } = await signupAgent("houserulesowner2");
    const world = await agent.post("/api/worlds").send({ name: "Gritty World" });
    const worldId = world.body.id as string;

    const patched = await agent.patch(`/api/worlds/${worldId}`).send({
      houseRules: { carryCapacityMultiplier: 10, pointBuyBudget: 20, encounterDifficultyMultiplier: 0.8 },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.houseRules).toEqual({ carryCapacityMultiplier: 10, pointBuyBudget: 20, encounterDifficultyMultiplier: 0.8 });

    const single = await agent.get(`/api/worlds/${worldId}`);
    expect(single.body.houseRules).toEqual({ carryCapacityMultiplier: 10, pointBuyBudget: 20, encounterDifficultyMultiplier: 0.8 });

    const list = await agent.get("/api/worlds");
    expect(list.body.find((w: { id: string }) => w.id === worldId).houseRules).toEqual({ carryCapacityMultiplier: 10, pointBuyBudget: 20, encounterDifficultyMultiplier: 0.8 });
  });

  it("drops unknown keys and non-positive-number values, keeping the rest", async () => {
    const { agent } = await signupAgent("houserulesowner3");
    const world = await agent.post("/api/worlds").send({ name: "Malformed Rules World" });
    const worldId = world.body.id as string;

    const patched = await agent.patch(`/api/worlds/${worldId}`).send({
      houseRules: { carryCapacityMultiplier: 12, pointBuyBudget: -5, someMadeUpRule: 999, encounterDifficultyMultiplier: "not a number" },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.houseRules).toEqual({ carryCapacityMultiplier: 12 });
  });

  it("clears house rules back to empty by patching an empty object", async () => {
    const { agent } = await signupAgent("houserulesowner4");
    const world = await agent.post("/api/worlds").send({ name: "Reset Rules World" });
    const worldId = world.body.id as string;

    await agent.patch(`/api/worlds/${worldId}`).send({ houseRules: { pointBuyBudget: 30 } });
    const cleared = await agent.patch(`/api/worlds/${worldId}`).send({ houseRules: {} });
    expect(cleared.body.houseRules).toEqual({});
  });

  it("shows a member the owner's house rules but doesn't let the member change them", async () => {
    const { agent: owner } = await signupAgent("houserulesowner5");
    const world = await owner.post("/api/worlds").send({ name: "Shared Rules World" });
    const worldId = world.body.id as string;
    const joinCode = await owner.post(`/api/worlds/${worldId}/join-code`);

    const { agent: member } = await signupAgent("houserulesmember1");
    await member.post("/api/worlds/join").send({ code: joinCode.body.code });

    await owner.patch(`/api/worlds/${worldId}`).send({ houseRules: { pointBuyBudget: 25 } });

    const list = await member.get("/api/worlds");
    expect(list.body.find((w: { id: string }) => w.id === worldId).houseRules).toEqual({ pointBuyBudget: 25 });

    const memberPatch = await member.patch(`/api/worlds/${worldId}`).send({ houseRules: { pointBuyBudget: 99 } });
    expect(memberPatch.status).toBe(404);

    const stillSet = await owner.get(`/api/worlds/${worldId}`);
    expect(stillSet.body.houseRules).toEqual({ pointBuyBudget: 25 });
  });
});

describe("world calendar", () => {
  it("defaults currentDay to 1 for a new world", async () => {
    const { agent } = await signupAgent("calendarowner1");
    const world = await agent.post("/api/worlds").send({ name: "Calendar World" });
    expect(world.body.currentDay).toBe(1);

    const single = await agent.get(`/api/worlds/${world.body.id}`);
    expect(single.body.currentDay).toBe(1);

    const list = await agent.get("/api/worlds");
    expect(list.body.find((w: { id: string }) => w.id === world.body.id).currentDay).toBe(1);
  });

  it("advances currentDay by a positive integer via /advance-day", async () => {
    const { agent } = await signupAgent("calendarowner2");
    const world = await agent.post("/api/worlds").send({ name: "Advancing World" });
    const worldId = world.body.id as string;

    const first = await agent.post(`/api/worlds/${worldId}/advance-day`).send({ days: 3 });
    expect(first.status).toBe(200);
    expect(first.body.currentDay).toBe(4);

    const second = await agent.post(`/api/worlds/${worldId}/advance-day`).send({ days: 1 });
    expect(second.status).toBe(200);
    expect(second.body.currentDay).toBe(5);
  });

  it("400s advance-day with a non-positive or non-integer days value", async () => {
    const { agent } = await signupAgent("calendarowner3");
    const world = await agent.post("/api/worlds").send({ name: "Bad Advance World" });
    const worldId = world.body.id as string;

    for (const days of [0, -1, 1.5, "two", null, undefined]) {
      const res = await agent.post(`/api/worlds/${worldId}/advance-day`).send({ days });
      expect(res.status).toBe(400);
    }
  });

  it("404s advance-day for a non-owner", async () => {
    const { agent: owner } = await signupAgent("calendarowner4");
    const world = await owner.post("/api/worlds").send({ name: "Owned Calendar World" });
    const worldId = world.body.id as string;
    const joinCode = await owner.post(`/api/worlds/${worldId}/join-code`);

    const { agent: member } = await signupAgent("calendarmember1");
    await member.post("/api/worlds/join").send({ code: joinCode.body.code });

    const res = await member.post(`/api/worlds/${worldId}/advance-day`).send({ days: 1 });
    expect(res.status).toBe(404);

    const still = await owner.get(`/api/worlds/${worldId}`);
    expect(still.body.currentDay).toBe(1);
  });

  it("lets the owner set currentDay directly via PATCH, with validation", async () => {
    const { agent } = await signupAgent("calendarowner5");
    const world = await agent.post("/api/worlds").send({ name: "Direct Set World" });
    const worldId = world.body.id as string;

    const ok = await agent.patch(`/api/worlds/${worldId}`).send({ currentDay: 42 });
    expect(ok.status).toBe(200);
    expect(ok.body.currentDay).toBe(42);

    const bad = await agent.patch(`/api/worlds/${worldId}`).send({ currentDay: 0 });
    expect(bad.status).toBe(400);

    const stillOk = await agent.get(`/api/worlds/${worldId}`);
    expect(stillOk.body.currentDay).toBe(42);
  });
});

describe("world member roles", () => {
  it("defaults a joined member to the player role, visible in the members list", async () => {
    const { agent: owner } = await signupAgent("roleowner1");
    const world = await owner.post("/api/worlds").send({ name: "Role World" });
    const worldId = world.body.id as string;
    const joinCode = await owner.post(`/api/worlds/${worldId}/join-code`);

    const { agent: member, userId } = await signupAgent("rolemember1");
    await member.post("/api/worlds/join").send({ code: joinCode.body.code });

    const members = await owner.get(`/api/worlds/${worldId}/members`);
    expect(members.status).toBe(200);
    expect(members.body).toEqual([{ userId, username: "rolemember1", role: "player" }]);
  });

  it("issues a join code that grants coDM, and rejects an invalid role", async () => {
    const { agent: owner } = await signupAgent("roleowner2");
    const world = await owner.post("/api/worlds").send({ name: "CoDM World" });
    const worldId = world.body.id as string;

    const badRole = await owner.post(`/api/worlds/${worldId}/join-code`).send({ role: "wizard" });
    expect(badRole.status).toBe(400);

    const joinCode = await owner.post(`/api/worlds/${worldId}/join-code`).send({ role: "coDM" });
    expect(joinCode.status).toBe(200);

    const { agent: member, userId } = await signupAgent("rolemember2");
    await member.post("/api/worlds/join").send({ code: joinCode.body.code });

    const members = await owner.get(`/api/worlds/${worldId}/members`);
    expect(members.body).toEqual([{ userId, username: "rolemember2", role: "coDM" }]);
  });

  it("lets the owner promote and demote a member via PATCH, owner-only, with role validation", async () => {
    const { agent: owner } = await signupAgent("roleowner3");
    const world = await owner.post("/api/worlds").send({ name: "Promote World" });
    const worldId = world.body.id as string;
    const joinCode = await owner.post(`/api/worlds/${worldId}/join-code`);

    const { agent: member, userId } = await signupAgent("rolemember3");
    await member.post("/api/worlds/join").send({ code: joinCode.body.code });

    const nonOwnerAttempt = await member.patch(`/api/worlds/${worldId}/members/${userId}`).send({ role: "coDM" });
    expect(nonOwnerAttempt.status).toBe(404);

    const badRole = await owner.patch(`/api/worlds/${worldId}/members/${userId}`).send({ role: "wizard" });
    expect(badRole.status).toBe(400);

    const promote = await owner.patch(`/api/worlds/${worldId}/members/${userId}`).send({ role: "coDM" });
    expect(promote.status).toBe(204);

    const afterPromote = await owner.get(`/api/worlds/${worldId}/members`);
    expect(afterPromote.body).toEqual([{ userId, username: "rolemember3", role: "coDM" }]);

    const demote = await owner.patch(`/api/worlds/${worldId}/members/${userId}`).send({ role: "player" });
    expect(demote.status).toBe(204);

    const afterDemote = await owner.get(`/api/worlds/${worldId}/members`);
    expect(afterDemote.body).toEqual([{ userId, username: "rolemember3", role: "player" }]);
  });

  it("404s a PATCH for a userId that isn't a member of the world", async () => {
    const { agent: owner } = await signupAgent("roleowner4");
    const world = await owner.post("/api/worlds").send({ name: "Lonely World" });
    const worldId = world.body.id as string;

    const res = await owner.patch(`/api/worlds/${worldId}/members/not-a-real-user`).send({ role: "coDM" });
    expect(res.status).toBe(404);
  });
});
