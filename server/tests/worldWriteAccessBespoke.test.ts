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

async function joinAsRole(dm: request.Agent, worldId: string, role: "player" | "coDM", playerAgent: request.Agent) {
  const code = await dm.post(`/api/worlds/${worldId}/join-code`).send({ role });
  await playerAgent.post("/api/worlds/join").send({ code: code.body.code });
}

describe("world write access — Organizations Phase B, 1c bespoke files", () => {
  it("lets a coDM PUT the encounter, blocks a plain player", async () => {
    const { agent: dm } = await signupAgent("wwbdm1");
    const world = await dm.post("/api/worlds").send({ name: "Encounter World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwbcodm1");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwbplayer1");
    await joinAsRole(dm, worldId, "player", player);

    const put = await coDm.put(`/api/encounters/${worldId}`).send({ combatants: [], round: 1, turnIndex: 0 });
    expect(put.status).toBe(200);
    expect(put.body.round).toBe(1);

    expect((await player.put(`/api/encounters/${worldId}`).send({ combatants: [] })).status).toBe(403);
  });

  it("lets a coDM delete another author's codex note, blocks a plain player", async () => {
    const { agent: dm } = await signupAgent("wwbdm2");
    const world = await dm.post("/api/worlds").send({ name: "Codex World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwbcodm2");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwbplayer2");
    await joinAsRole(dm, worldId, "player", player);

    const location = await dm.post("/api/locations").send({
      worldId, name: "Old Well", locationType: "landmark", category: "wilderness",
      description: "A quiet clearing.", notableFeature: "an old well", keeper: "nobody", rumor: "it's haunted",
    });
    const note = await player.post("/api/codex-notes").send({
      entityType: "location", entityId: location.body.id, authorName: "Player One", text: "Found a coin here.",
    });
    expect(note.status).toBe(201);

    expect((await player.get(`/api/codex-notes?entityType=location&entityId=${location.body.id}`)).status).toBe(200);
    const otherPlayerDelete = await (await signupAgent("wwboutsider2")).agent.delete(`/api/codex-notes/${note.body.id}`);
    expect(otherPlayerDelete.status).toBe(403);

    const deleted = await coDm.delete(`/api/codex-notes/${note.body.id}`);
    expect(deleted.status).toBe(204);
  });

  it("lets a coDM delete another user's ledger entry, blocks a plain player", async () => {
    const { agent: dm } = await signupAgent("wwbdm3");
    const world = await dm.post("/api/worlds").send({ name: "Ledger World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwbcodm3");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwbplayer3");
    await joinAsRole(dm, worldId, "player", player);

    const entry = await player.post("/api/ledger").send({ worldId, kind: "gold", label: "Found treasure", amount: 50, authorName: "Player Three" });
    expect(entry.status).toBe(201);

    expect((await player.delete(`/api/ledger/${entry.body.id}`)).status).toBe(204);

    const entry2 = await player.post("/api/ledger").send({ worldId, kind: "gold", label: "More treasure", amount: 25, authorName: "Player Three" });
    const deleted = await coDm.delete(`/api/ledger/${entry2.body.id}`);
    expect(deleted.status).toBe(204);
  });

  it("lets a coDM delete another user's chat message, blocks a plain player", async () => {
    const { agent: dm } = await signupAgent("wwbdm4");
    const world = await dm.post("/api/worlds").send({ name: "Chat World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwbcodm4");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwbplayer4");
    await joinAsRole(dm, worldId, "player", player);

    const message = await player.post("/api/chat").send({ worldId, text: "Hello, party!" });
    expect(message.status).toBe(201);

    expect((await coDm.delete(`/api/chat/${message.body.id}`)).status).toBe(204);

    const message2 = await player.post("/api/chat").send({ worldId, text: "Anyone there?" });
    const { agent: outsider } = await signupAgent("wwboutsider4");
    expect((await outsider.delete(`/api/chat/${message2.body.id}`)).status).toBe(403);
  });

  it("lets a coDM delete another user's downtime activity, blocks a plain player", async () => {
    const { agent: dm } = await signupAgent("wwbdm5");
    const world = await dm.post("/api/worlds").send({ name: "Downtime World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwbcodm5");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwbplayer5");
    await joinAsRole(dm, worldId, "player", player);

    const activity = await player.post("/api/downtime").send({
      worldId, characterName: "Bram", activityType: "training", description: "Sword drills", daysSpent: 3,
    });
    expect(activity.status).toBe(201);

    const { agent: outsider } = await signupAgent("wwboutsider5");
    expect((await outsider.delete(`/api/downtime/${activity.body.id}`)).status).toBe(403);

    const deleted = await coDm.delete(`/api/downtime/${activity.body.id}`);
    expect(deleted.status).toBe(204);
  });

  it("lets a coDM delete another user's roll log entry, blocks a plain player", async () => {
    const { agent: dm } = await signupAgent("wwbdm6");
    const world = await dm.post("/api/worlds").send({ name: "Roll Log World" });
    const worldId = world.body.id as string;
    const { agent: coDm } = await signupAgent("wwbcodm6");
    await joinAsRole(dm, worldId, "coDM", coDm);
    const { agent: player } = await signupAgent("wwbplayer6");
    await joinAsRole(dm, worldId, "player", player);

    const roll = await player.post("/api/roll-log").send({
      worldId, rollerName: "Player Six", notation: "1d20+3", results: [15], modifier: 3, total: 18,
    });
    expect(roll.status).toBe(201);

    const { agent: outsider } = await signupAgent("wwboutsider6");
    expect((await outsider.delete(`/api/roll-log/${roll.body.id}`)).status).toBe(403);

    const deleted = await coDm.delete(`/api/roll-log/${roll.body.id}`);
    expect(deleted.status).toBe(204);
  });
});
