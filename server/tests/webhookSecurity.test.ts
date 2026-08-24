import { describe, it, expect, vi } from "vitest";
import { isPrivateOrReservedIp, validateWebhookUrl, WebhookUrlError } from "../src/webhookSecurity.js";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === "public.example.com") return [{ address: "93.184.216.34" }];
    if (hostname === "rebinder.example.com") return [{ address: "127.0.0.1" }];
    if (hostname === "unresolvable.example.com") throw new Error("ENOTFOUND");
    return [{ address: "93.184.216.34" }];
  }),
}));

describe("isPrivateOrReservedIp", () => {
  it("flags loopback, private, link-local, and cloud metadata IPv4 ranges", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true); // cloud metadata
    expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
  });

  it("flags IPv6 loopback, unique-local, and link-local ranges", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true); // IPv4-mapped loopback
  });

  it("allows ordinary public IPv4 and IPv6 addresses", () => {
    expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);
    expect(isPrivateOrReservedIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });
});

describe("validateWebhookUrl", () => {
  it("rejects non-https URLs", async () => {
    await expect(validateWebhookUrl("http://public.example.com/hook")).rejects.toThrow(WebhookUrlError);
  });

  it("rejects an unparseable URL", async () => {
    await expect(validateWebhookUrl("not a url")).rejects.toThrow(WebhookUrlError);
  });

  it("rejects localhost outright, without a DNS lookup", async () => {
    await expect(validateWebhookUrl("https://localhost/hook")).rejects.toThrow(/localhost/);
  });

  it("rejects an https URL whose host is a private IP literal", async () => {
    await expect(validateWebhookUrl("https://127.0.0.1/hook")).rejects.toThrow(WebhookUrlError);
    await expect(validateWebhookUrl("https://169.254.169.254/latest/meta-data")).rejects.toThrow(WebhookUrlError);
  });

  it("rejects a hostname that resolves to a private IP (DNS rebinding defense)", async () => {
    await expect(validateWebhookUrl("https://rebinder.example.com/hook")).rejects.toThrow(WebhookUrlError);
  });

  it("rejects a hostname that fails to resolve", async () => {
    await expect(validateWebhookUrl("https://unresolvable.example.com/hook")).rejects.toThrow(WebhookUrlError);
  });

  it("accepts an https URL whose host resolves to a public IP", async () => {
    await expect(validateWebhookUrl("https://public.example.com/hook")).resolves.toBeUndefined();
  });
});
