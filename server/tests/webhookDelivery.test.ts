import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deliverWebhook, signWebhookPayload } from "../src/webhookDelivery.js";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34" }]),
}));

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("signWebhookPayload", () => {
  it("produces a deterministic hex HMAC-SHA256 of the body", () => {
    const sig1 = signWebhookPayload("secret", '{"a":1}');
    const sig2 = signWebhookPayload("secret", '{"a":1}');
    const sig3 = signWebhookPayload("other-secret", '{"a":1}');
    expect(sig1).toBe(sig2);
    expect(sig1).not.toBe(sig3);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("deliverWebhook", () => {
  it("refuses to deliver to an unsafe URL without ever calling fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await deliverWebhook("http://public.example.com/hook", "secret", { hello: "world" });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs a signed JSON body and reports success on a 2xx response", async () => {
    let capturedBody = "";
    let capturedSignature = "";
    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = init!.body as string;
      capturedSignature = (init!.headers as Record<string, string>)["x-spark-signature"];
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await deliverWebhook("https://public.example.com/hook", "my-secret", { hello: "world" });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(capturedBody).toBe(JSON.stringify({ hello: "world" }));
    expect(capturedSignature).toBe(signWebhookPayload("my-secret", capturedBody));
  });

  it("reports failure on a non-2xx response", async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    const result = await deliverWebhook("https://public.example.com/hook", "secret", {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it("reports failure without throwing when the request errors out", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await deliverWebhook("https://public.example.com/hook", "secret", {});
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
