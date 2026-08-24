import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { resetDb } from "./resetDb.js";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34" }]),
}));

const originalFetch = global.fetch;

beforeEach(resetDb);
afterEach(() => {
  global.fetch = originalFetch;
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function signupAgent(username: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({ username, password: "password123" });
  return { agent, userId: res.body.id as string };
}

function charPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: "npc",
    name: "Test NPC",
    alignment: "Neutral",
    templateId: "guard",
    templateName: "Guard",
    statBlock: { size: "Medium", creatureType: "humanoid", armorClass: 12, hitPointsAverage: 10, hitDiceFormula: "2d8+2", speed: "30 ft.", abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, challengeRating: "1/8", proficiencyBonus: 2, actions: [] },
    backstory: { role: "guard", appearance: "plain", personality: "quiet", mannerism: "none", ideal: "duty", bond: "none", flaw: "none", motivation: "pay", secret: "none" },
    ...overrides,
  };
}

describe("world webhook config — owner-only CRUD", () => {
  it("404s GET/PATCH/DELETE when no webhook is configured, and for a non-owner", async () => {
    const { agent: owner } = await signupAgent("webhookowner1");
    const world = await owner.post("/api/worlds").send({ name: "Webhook World" });
    const worldId = world.body.id as string;

    expect((await owner.get(`/api/worlds/${worldId}/webhook`)).status).toBe(404);

    const { agent: other } = await signupAgent("webhookother1");
    const created = await owner.post(`/api/worlds/${worldId}/webhook`).send({ url: "https://public.example.com/hook" });
    expect(created.status).toBe(201);
    expect(created.body.secret).toMatch(/^[0-9a-f]{64}$/);

    expect((await other.get(`/api/worlds/${worldId}/webhook`)).status).toBe(404);
    expect((await other.patch(`/api/worlds/${worldId}/webhook`).send({ enabled: false })).status).toBe(404);
    expect((await other.delete(`/api/worlds/${worldId}/webhook`)).status).toBe(404);
  });

  it("creates a webhook, never returns the secret again, and lets the owner toggle/delete it", async () => {
    const { agent } = await signupAgent("webhookowner2");
    const world = await agent.post("/api/worlds").send({ name: "Webhook World 2" });
    const worldId = world.body.id as string;

    const created = await agent.post(`/api/worlds/${worldId}/webhook`).send({ url: "https://public.example.com/hook" });
    expect(created.status).toBe(201);
    const secret = created.body.secret as string;
    expect(secret).toBeTruthy();

    const fetched = await agent.get(`/api/worlds/${worldId}/webhook`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.url).toBe("https://public.example.com/hook");
    expect(fetched.body.enabled).toBe(true);
    expect(fetched.body.secret).toBeUndefined();

    const disabled = await agent.patch(`/api/worlds/${worldId}/webhook`).send({ enabled: false });
    expect(disabled.status).toBe(204);
    expect((await agent.get(`/api/worlds/${worldId}/webhook`)).body.enabled).toBe(false);

    const deleted = await agent.delete(`/api/worlds/${worldId}/webhook`);
    expect(deleted.status).toBe(204);
    expect((await agent.get(`/api/worlds/${worldId}/webhook`)).status).toBe(404);
  });

  it("rejects an unsafe webhook URL (SSRF protection) with 400 and never stores it", async () => {
    const { agent } = await signupAgent("webhookowner3");
    const world = await agent.post("/api/worlds").send({ name: "Webhook World 3" });
    const worldId = world.body.id as string;

    const httpRejected = await agent.post(`/api/worlds/${worldId}/webhook`).send({ url: "http://public.example.com/hook" });
    expect(httpRejected.status).toBe(400);

    const privateIpRejected = await agent.post(`/api/worlds/${worldId}/webhook`).send({ url: "https://127.0.0.1/hook" });
    expect(privateIpRejected.status).toBe(400);

    const metadataRejected = await agent.post(`/api/worlds/${worldId}/webhook`).send({ url: "https://169.254.169.254/latest/meta-data" });
    expect(metadataRejected.status).toBe(400);

    expect((await agent.get(`/api/worlds/${worldId}/webhook`)).status).toBe(404);
  });

  it("test-ping sends an immediate signed request and reports the outcome", async () => {
    const { agent } = await signupAgent("webhookowner4");
    const world = await agent.post("/api/worlds").send({ name: "Webhook World 4" });
    const worldId = world.body.id as string;
    await agent.post(`/api/worlds/${worldId}/webhook`).send({ url: "https://public.example.com/hook" });

    global.fetch = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    const ok = await agent.post(`/api/worlds/${worldId}/webhook/test`);
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    expect((await agent.get(`/api/worlds/${worldId}/webhook`)).body.lastDeliveryOk).toBe(true);

    global.fetch = vi.fn(async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    const failed = await agent.post(`/api/worlds/${worldId}/webhook/test`);
    expect(failed.status).toBe(200);
    expect(failed.body.ok).toBe(false);
    expect((await agent.get(`/api/worlds/${worldId}/webhook`)).body.lastDeliveryOk).toBe(false);
  });
});

describe("world webhook — CampaignEventLog dispatch wiring", () => {
  it("delivers a signed webhook when a disposition change is logged for the world", async () => {
    const { agent } = await signupAgent("webhookowner5");
    const world = await agent.post("/api/worlds").send({ name: "Webhook World 5" });
    const worldId = world.body.id as string;
    await agent.post(`/api/worlds/${worldId}/webhook`).send({ url: "https://public.example.com/hook" });

    const char = await agent.post("/api/characters").send(charPayload({ worldId }));
    const charId = char.body.id as string;

    let capturedBody: string | undefined;
    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = init!.body as string;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const adjust = await agent.post(`/api/characters/${charId}/adjust-disposition`).send({ delta: 5, reason: "Test" });
    expect(adjust.status).toBe(200);

    await vi.waitFor(() => {
      expect(capturedBody).toBeDefined();
    });
    const payload = JSON.parse(capturedBody!);
    expect(payload.worldId).toBe(worldId);
    expect(payload.eventType).toBe("disposition.adjusted");
    expect(payload.payload.delta).toBe(5);

    await vi.waitFor(async () => {
      const webhook = await agent.get(`/api/worlds/${worldId}/webhook`);
      expect(webhook.body.lastDeliveryOk).toBe(true);
    });
  });

  it("never calls fetch when the world has no webhook configured", async () => {
    const { agent } = await signupAgent("webhookowner6");
    const world = await agent.post("/api/worlds").send({ name: "Webhook World 6" });
    const worldId = world.body.id as string;
    const char = await agent.post("/api/characters").send(charPayload({ worldId }));
    const charId = char.body.id as string;

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await agent.post(`/api/characters/${charId}/adjust-disposition`).send({ delta: 5 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not deliver when the webhook is disabled", async () => {
    const { agent } = await signupAgent("webhookowner7");
    const world = await agent.post("/api/worlds").send({ name: "Webhook World 7" });
    const worldId = world.body.id as string;
    await agent.post(`/api/worlds/${worldId}/webhook`).send({ url: "https://public.example.com/hook" });
    await agent.patch(`/api/worlds/${worldId}/webhook`).send({ enabled: false });

    const char = await agent.post("/api/characters").send(charPayload({ worldId }));
    const charId = char.body.id as string;

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await agent.post(`/api/characters/${charId}/adjust-disposition`).send({ delta: 5 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
