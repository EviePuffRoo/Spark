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

function questPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Rescue the Merchant", questType: "rescue", tier: "local", hook: "hook",
    objective: "objective", complication: "complication", reward: "reward",
    ...overrides,
  };
}

describe("quest chains", () => {
  it("sets a prerequisiteQuestId on create and returns it", async () => {
    const { agent } = await signupAgent("questdm1");
    const first = await agent.post("/api/quests").send(questPayload({ title: "Part One" }));
    const firstId = first.body.id as string;

    const second = await agent.post("/api/quests").send(questPayload({ title: "Part Two", prerequisiteQuestId: firstId }));
    expect(second.status).toBe(201);
    expect(second.body.prerequisiteQuestId).toBe(firstId);
  });

  it("sets and clears prerequisiteQuestId via PATCH", async () => {
    const { agent } = await signupAgent("questdm2");
    const first = await agent.post("/api/quests").send(questPayload({ title: "Part One" }));
    const second = await agent.post("/api/quests").send(questPayload({ title: "Part Two" }));
    const firstId = first.body.id as string;
    const secondId = second.body.id as string;

    const patch = await agent.patch(`/api/quests/${secondId}`).send({ prerequisiteQuestId: firstId });
    expect(patch.status).toBe(200);
    expect(patch.body.prerequisiteQuestId).toBe(firstId);

    const clear = await agent.patch(`/api/quests/${secondId}`).send({ prerequisiteQuestId: null });
    expect(clear.status).toBe(200);
    expect(clear.body.prerequisiteQuestId).toBeNull();
  });

  it("400s a quest set as its own prerequisite", async () => {
    const { agent } = await signupAgent("questdm3");
    const quest = await agent.post("/api/quests").send(questPayload());
    const id = quest.body.id as string;

    const patch = await agent.patch(`/api/quests/${id}`).send({ prerequisiteQuestId: id });
    expect(patch.status).toBe(400);
  });

  it("400s a prerequisite chain that would cycle", async () => {
    const { agent } = await signupAgent("questdm4");
    const a = await agent.post("/api/quests").send(questPayload({ title: "A" }));
    const b = await agent.post("/api/quests").send(questPayload({ title: "B" }));
    const aId = a.body.id as string;
    const bId = b.body.id as string;

    // B's prerequisite is A
    const setup = await agent.patch(`/api/quests/${bId}`).send({ prerequisiteQuestId: aId });
    expect(setup.status).toBe(200);

    // Now try to make A's prerequisite be B, which would cycle A -> B -> A
    const cycle = await agent.patch(`/api/quests/${aId}`).send({ prerequisiteQuestId: bId });
    expect(cycle.status).toBe(400);
  });

  it("403s a prerequisiteQuestId pointing at another user's quest", async () => {
    const { agent: owner } = await signupAgent("questdm5");
    const theirs = await owner.post("/api/quests").send(questPayload());
    const theirsId = theirs.body.id as string;

    const { agent: other } = await signupAgent("questdm6");
    const mine = await other.post("/api/quests").send(questPayload());
    const mineId = mine.body.id as string;

    const patch = await other.patch(`/api/quests/${mineId}`).send({ prerequisiteQuestId: theirsId });
    expect(patch.status).toBe(403);
  });

  it("clears prerequisiteQuestId on dependent quests when the prerequisite is deleted", async () => {
    const { agent } = await signupAgent("questdm7");
    const first = await agent.post("/api/quests").send(questPayload({ title: "Part One" }));
    const second = await agent.post("/api/quests").send(questPayload({ title: "Part Two" }));
    const firstId = first.body.id as string;
    const secondId = second.body.id as string;
    await agent.patch(`/api/quests/${secondId}`).send({ prerequisiteQuestId: firstId });

    await agent.delete(`/api/quests/${firstId}`);

    const row = await prisma.questHook.findUnique({ where: { id: secondId } });
    expect(row?.prerequisiteQuestId).toBeNull();
  });
});
