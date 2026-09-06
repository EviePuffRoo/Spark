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

describe("room state patch endpoint", () => {
  async function makeDungeon(username: string) {
    const { agent } = await signupAgent(username);
    const templateId = await makeTemplate(agent, `${username} Layout`);
    const created = await agent.post("/api/dungeons").send({
      name: "Barrow",
      rooms: [
        { id: "r1", name: "Antechamber", templateId, exits: [] },
        { id: "r2", name: "Vault", templateId, exits: [] },
      ],
    });
    return { agent, dungeonId: created.body.id as string };
  }

  const stateOf = (body: { rooms: { id: string; state?: unknown }[] }, roomId: string) =>
    body.rooms.find((r) => r.id === roomId)?.state;

  it("merges a patch onto a room that had no state yet", async () => {
    const { agent, dungeonId } = await makeDungeon("roomstate1");
    const res = await agent.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`)
      .send({ cleared: true, lastVisitedDay: 4, disarmedHazardZoneIds: ["z2"] });
    expect(res.status).toBe(200);
    expect(stateOf(res.body, "r1")).toEqual({ cleared: true, alerted: false, lastVisitedDay: 4, disarmedHazardZoneIds: ["z2"] });
    // Untouched rooms keep whatever they had.
    expect(stateOf(res.body, "r2")).toBeUndefined();
  });

  it("never clears alerted through this route, whatever the patch says", async () => {
    // The invariant the client-side read-modify-write used to lose: a leave
    // report computed before a flee landed wrote alerted straight back to
    // false. Only the editor's wholesale rooms PATCH can reset it now.
    const { agent, dungeonId } = await makeDungeon("roomstate2");
    await agent.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`).send({ alerted: true });
    const res = await agent.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`).send({ cleared: true, alerted: false });
    expect(res.status).toBe(200);
    expect(stateOf(res.body, "r1")).toMatchObject({ cleared: true, alerted: true });
  });

  it("accumulates disarmed traps across visits", async () => {
    const { agent, dungeonId } = await makeDungeon("roomstate3");
    await agent.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`).send({ disarmedHazardZoneIds: ["z2"] });
    const res = await agent.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`).send({ disarmedHazardZoneIds: ["z5"] });
    expect((stateOf(res.body, "r1") as { disarmedHazardZoneIds: string[] }).disarmedHazardZoneIds.sort()).toEqual(["z2", "z5"]);
  });

  it("keeps both reports when two land at once", async () => {
    // The whole reason for the lock: these two interleave in real play (a
    // monster flees, the party leaves a moment later) and neither finding
    // may be lost.
    const { agent, dungeonId } = await makeDungeon("roomstate4");
    const [flee, leave] = await Promise.all([
      agent.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`).send({ alerted: true }),
      agent.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`).send({ cleared: true, disarmedHazardZoneIds: ["z2"] }),
    ]);
    expect(flee.status).toBe(200);
    expect(leave.status).toBe(200);

    const fetched = await agent.get(`/api/dungeons/${dungeonId}`);
    expect(stateOf(fetched.body, "r1")).toMatchObject({ cleared: true, alerted: true, disarmedHazardZoneIds: ["z2"] });
  });

  it("404s an unknown room, and an unknown dungeon", async () => {
    const { agent, dungeonId } = await makeDungeon("roomstate5");
    expect((await agent.patch(`/api/dungeons/${dungeonId}/rooms/nope/state`).send({ cleared: true })).status).toBe(404);
    expect((await agent.patch(`/api/dungeons/does-not-exist/rooms/r1/state`).send({ cleared: true })).status).toBe(404);
  });

  it("404s someone else's dungeon rather than letting them mark it alerted", async () => {
    const { dungeonId } = await makeDungeon("roomstate6");
    const { agent: stranger } = await signupAgent("roomstate6-stranger");
    const res = await stranger.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`).send({ alerted: true });
    expect(res.status).toBe(404);
  });

  it("400s a malformed patch instead of storing it", async () => {
    const { agent, dungeonId } = await makeDungeon("roomstate7");
    const res = await agent.patch(`/api/dungeons/${dungeonId}/rooms/r1/state`).send({ cleared: "yes" });
    expect(res.status).toBe(400);
  });
});
