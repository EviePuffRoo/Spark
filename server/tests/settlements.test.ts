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

function settlementPayload(overrides: Record<string, unknown> = {}) {
  return { name: "Stonegatehaven", settlementType: "Town", description: "A trade town.", ...overrides };
}

describe("settlement prosperity, danger level, and faction control", () => {
  it("creates and round-trips prosperity and dangerLevel", async () => {
    const { agent } = await signupAgent("settledm1");
    const res = await agent.post("/api/settlements").send(settlementPayload({ prosperity: "Prosperous", dangerLevel: "Watchful" }));
    expect(res.status).toBe(201);
    expect(res.body.prosperity).toBe("Prosperous");
    expect(res.body.dangerLevel).toBe("Watchful");

    const patched = await agent.patch(`/api/settlements/${res.body.id}`).send({ prosperity: "Struggling" });
    expect(patched.status).toBe(200);
    expect(patched.body.prosperity).toBe("Struggling");
    expect(patched.body.dangerLevel).toBe("Watchful");
  });

  it("assigns a controlling faction the caller owns and returns its id", async () => {
    const { agent } = await signupAgent("settledm2");
    const faction = await agent.post("/api/factions").send({
      name: "The Iron Concord", factionType: "Guild", agenda: "Control trade.", methods: "Bribery.", publicFace: "Merchants.", hook: "At war with a rival.",
    });
    const settlement = await agent.post("/api/settlements").send(settlementPayload());

    const res = await agent.patch(`/api/settlements/${settlement.body.id}`).send({ controllingFactionId: faction.body.id });
    expect(res.status).toBe(200);
    expect(res.body.controllingFactionId).toBe(faction.body.id);

    const cleared = await agent.patch(`/api/settlements/${settlement.body.id}`).send({ controllingFactionId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.controllingFactionId).toBeNull();
  });

  it("403s assigning a controlling faction the caller doesn't own", async () => {
    const { agent: owner } = await signupAgent("settledm3");
    const faction = await owner.post("/api/factions").send({
      name: "The Sable Choir", factionType: "Cult", agenda: "Spread influence.", methods: "Ritual.", publicFace: "Harmless.", hook: "Recruiting.",
    });

    const { agent: other } = await signupAgent("settledm4");
    const settlement = await other.post("/api/settlements").send(settlementPayload());

    const res = await other.patch(`/api/settlements/${settlement.body.id}`).send({ controllingFactionId: faction.body.id });
    expect(res.status).toBe(403);

    const row = await prisma.settlement.findUnique({ where: { id: settlement.body.id } });
    expect(row?.controllingFactionId).toBeNull();
  });
});
