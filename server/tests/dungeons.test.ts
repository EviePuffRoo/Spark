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

async function makeTemplate(agent: request.Agent, name: string) {
  const zones = [
    { id: "z1", name: "Entry", tags: [], x: 0, y: 0, connections: ["z2"], revealed: true },
    { id: "z2", name: "Trap Room", tags: [], x: 100, y: 0, connections: ["z1"], revealed: true, hazard: { label: "Dart trap", damage: 8 } },
  ];
  const res = await agent.post("/api/zone-map-templates").send({ name, zones });
  return res.body.id as string;
}

describe("dungeon room memory (state field)", () => {
  it("round-trips room state (cleared/alerted/lastVisitedDay/disarmedHazardZoneIds) through create and patch", async () => {
    const { agent } = await signupAgent("dungeondm1");
    const templateId = await makeTemplate(agent, "Crypt Layout");

    const created = await agent.post("/api/dungeons").send({
      name: "The Sunken Crypt",
      rooms: [{ id: "r1", name: "Entry Hall", templateId, exits: [] }],
    });
    expect(created.status).toBe(201);
    expect(created.body.rooms[0].state).toBeUndefined();

    const patched = await agent.patch(`/api/dungeons/${created.body.id}`).send({
      rooms: [{
        id: "r1", name: "Entry Hall", templateId, exits: [],
        state: { cleared: true, alerted: false, lastVisitedDay: 12, disarmedHazardZoneIds: ["z2"] },
      }],
    });
    expect(patched.status).toBe(200);
    expect(patched.body.rooms[0].state).toEqual({ cleared: true, alerted: false, lastVisitedDay: 12, disarmedHazardZoneIds: ["z2"] });

    const fetched = await agent.get(`/api/dungeons/${created.body.id}`);
    expect(fetched.body.rooms[0].state).toEqual({ cleared: true, alerted: false, lastVisitedDay: 12, disarmedHazardZoneIds: ["z2"] });
  });

  it("defaults malformed state fields rather than rejecting the whole room", async () => {
    const { agent } = await signupAgent("dungeondm2");
    const templateId = await makeTemplate(agent, "Ruins Layout");

    const created = await agent.post("/api/dungeons").send({
      name: "Old Ruins",
      rooms: [{
        id: "r1", name: "Hall", templateId, exits: [],
        state: { cleared: "yes", alerted: 1, disarmedHazardZoneIds: "not-an-array" },
      }],
    });
    expect(created.status).toBe(201);
    expect(created.body.rooms[0].state).toEqual({ cleared: true, alerted: true, lastVisitedDay: undefined, disarmedHazardZoneIds: [] });
  });

  it("preserves a room's state across an unrelated patch to another field", async () => {
    const { agent } = await signupAgent("dungeondm3");
    const templateId = await makeTemplate(agent, "Vault Layout");

    const created = await agent.post("/api/dungeons").send({
      name: "The Vault",
      rooms: [{ id: "r1", name: "Antechamber", templateId, exits: [], state: { cleared: true, alerted: true, disarmedHazardZoneIds: ["z2"] } }],
    });

    const renamed = await agent.patch(`/api/dungeons/${created.body.id}`).send({
      rooms: [{ ...created.body.rooms[0], name: "Antechamber (renamed)" }],
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.rooms[0].name).toBe("Antechamber (renamed)");
    expect(renamed.body.rooms[0].state).toEqual({ cleared: true, alerted: true, lastVisitedDay: undefined, disarmedHazardZoneIds: ["z2"] });
  });

  it("404s a patch from a non-owner", async () => {
    const { agent: dm } = await signupAgent("dungeondm4");
    const templateId = await makeTemplate(dm, "Owner Only Layout");
    const created = await dm.post("/api/dungeons").send({
      name: "Owner's Dungeon",
      rooms: [{ id: "r1", name: "Hall", templateId, exits: [] }],
    });

    const { agent: other } = await signupAgent("dungeonother4");
    const res = await other.patch(`/api/dungeons/${created.body.id}`).send({
      rooms: [{ ...created.body.rooms[0], state: { cleared: true, alerted: false, disarmedHazardZoneIds: [] } }],
    });
    expect(res.status).toBe(404);
  });
});

// An exit can name which edge of its room's battle map it sits on, so the
// grid can offer the trip without going back to the zone view. The exit
// schema strips unknown keys, so a field that isn't declared there is
// silently dropped on save — which would look like the DM's choice simply
// not sticking, with nothing in the response to say why.
describe("dungeon exits carrying a battle-map edge", () => {
  it("round-trips mapEdge through create and update", async () => {
    const { agent } = await signupAgent("edgedm");
    const templateId = await makeTemplate(agent, "Edge Template");

    const created = await agent.post("/api/dungeons").send({
      name: "Edged Dungeon",
      rooms: [
        { id: "r1", name: "Hall", templateId, exits: [{ zoneId: "z1", toRoomId: "r2", label: "Through to", mapEdge: "north" }] },
        { id: "r2", name: "Vault", templateId, exits: [{ zoneId: "z1", toRoomId: "r1", mapEdge: "south" }] },
      ],
    });
    expect(created.status).toBe(201);
    expect(created.body.rooms[0].exits[0].mapEdge).toBe("north");
    expect(created.body.rooms[0].exits[0].label).toBe("Through to");
    expect(created.body.rooms[1].exits[0].mapEdge).toBe("south");

    const patched = await agent.patch(`/api/dungeons/${created.body.id}`).send({
      rooms: [
        { id: "r1", name: "Hall", templateId, exits: [{ zoneId: "z1", toRoomId: "r2", mapEdge: "east" }] },
        { id: "r2", name: "Vault", templateId, exits: [{ zoneId: "z1", toRoomId: "r1" }] },
      ],
    });
    expect(patched.status).toBe(200);
    expect(patched.body.rooms[0].exits[0].mapEdge).toBe("east");
    // An exit with no edge stays valid — it just isn't offered on the grid.
    expect(patched.body.rooms[1].exits[0].mapEdge).toBeUndefined();
  });

  it("drops a bogus edge rather than rejecting the whole dungeon", async () => {
    const { agent } = await signupAgent("edgedm2");
    const templateId = await makeTemplate(agent, "Edge Template 2");

    const created = await agent.post("/api/dungeons").send({
      name: "Bad Edge",
      rooms: [{ id: "r1", name: "Hall", templateId, exits: [{ zoneId: "z1", toRoomId: "r2", mapEdge: "sideways" }] }],
    });
    expect(created.status).toBe(201);
    expect(created.body.rooms[0].exits[0].toRoomId).toBe("r2");
    expect(created.body.rooms[0].exits[0].mapEdge).toBeUndefined();
  });
});
