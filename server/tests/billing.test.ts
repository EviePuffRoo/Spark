import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { prisma } from "../src/db.js";
import { resetDb } from "./resetDb.js";
import { stripeMockState, resetStripeMockState, MockStripeInvalidRequestError } from "./mocks/stripeMock.js";

vi.mock("stripe", async () => {
  const mod = await import("./mocks/stripeMock.js");
  return { default: mod.default };
});

// Imported after the mock is registered so billing.ts's `new Stripe(...)`
// picks up the mock class.
const { app } = await import("../src/app.js");

function staleCustomerError() {
  return new MockStripeInvalidRequestError({ message: "No such customer", code: "resource_missing", param: "customer" });
}

beforeEach(() => {
  resetStripeMockState();
  return resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function signupAgent(username: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({ username, password: "password123" });
  return { agent, userId: res.body.id as string };
}

describe("POST /api/billing/checkout", () => {
  it("creates a Stripe customer and returns a checkout URL for a first-time subscriber", async () => {
    const { agent, userId } = await signupAgent("payer1");
    const res = await agent.post("/api/billing/checkout");
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://checkout.stripe.com/mock-session");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.stripeCustomerId).toMatch(/^cus_mock_/);
  });

  it("self-heals a stale stripeCustomerId by creating a fresh customer and retrying", async () => {
    const { agent, userId } = await signupAgent("payer2");
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: "cus_stale_from_wrong_account" } });

    let calls = 0;
    stripeMockState.createCheckoutSession = async () => {
      calls++;
      if (calls === 1) throw staleCustomerError();
      return { url: "https://checkout.stripe.com/mock-session-retry" };
    };

    const res = await agent.post("/api/billing/checkout");
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://checkout.stripe.com/mock-session-retry");
    expect(calls).toBe(2);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.stripeCustomerId).not.toBe("cus_stale_from_wrong_account");
  });

  it("surfaces a non-stale Stripe error as a 502 with Stripe's message", async () => {
    const { agent } = await signupAgent("payer3");
    stripeMockState.createCheckoutSession = async () => {
      throw new MockStripeInvalidRequestError({ message: "No such price: 'price_bad'", code: "resource_missing", param: "price" });
    };

    const res = await agent.post("/api/billing/checkout");
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/No such price/);
  });
});

describe("POST /api/billing/portal", () => {
  it("returns a portal URL for a subscriber with a stripeCustomerId", async () => {
    const { agent, userId } = await signupAgent("payer4");
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: "cus_real" } });

    const res = await agent.post("/api/billing/portal");
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://billing.stripe.com/mock-portal");
  });

  it("400s with a clear message when the user has never subscribed", async () => {
    const { agent } = await signupAgent("payer5");
    const res = await agent.post("/api/billing/portal");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/upgrade first/i);
  });

  it("400s the same way for a stale stripeCustomerId (nothing to self-heal into)", async () => {
    const { agent, userId } = await signupAgent("payer6");
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: "cus_stale" } });
    stripeMockState.createPortalSession = async () => { throw staleCustomerError(); };

    const res = await agent.post("/api/billing/portal");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/upgrade first/i);
  });
});

describe("POST /api/billing/webhook", () => {
  async function postEvent(event: unknown, signature = "test-signature") {
    return request(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(JSON.stringify(event));
  }

  it("400s on an invalid signature", async () => {
    const res = await postEvent({ type: "checkout.session.completed", data: { object: {} } }, "wrong-signature");
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/signature verification failed/i);
  });

  it("flips tier to paid on checkout.session.completed", async () => {
    const { userId } = await signupAgent("webhookuser1");
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: "cus_wh1", tier: "free" } });

    const res = await postEvent({ type: "checkout.session.completed", data: { object: { customer: "cus_wh1" } } });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.tier).toBe("paid");
  });

  it("flips tier based on customer.subscription.updated status", async () => {
    const { userId } = await signupAgent("webhookuser2");
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: "cus_wh2", tier: "free" } });

    const active = await postEvent({ type: "customer.subscription.updated", data: { object: { customer: "cus_wh2", status: "active" } } });
    expect(active.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.tier).toBe("paid");

    const canceled = await postEvent({ type: "customer.subscription.updated", data: { object: { customer: "cus_wh2", status: "canceled" } } });
    expect(canceled.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.tier).toBe("free");
  });

  it("flips tier to free on customer.subscription.deleted", async () => {
    const { userId } = await signupAgent("webhookuser3");
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: "cus_wh3", tier: "paid" } });

    const res = await postEvent({ type: "customer.subscription.deleted", data: { object: { customer: "cus_wh3" } } });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.tier).toBe("free");
  });
});
