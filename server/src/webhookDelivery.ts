import { createHmac } from "node:crypto";
import { validateWebhookUrl, WebhookUrlError } from "./webhookSecurity.js";

const DELIVERY_TIMEOUT_MS = 5000;

export interface WebhookDeliveryResult {
  ok: boolean;
  status?: number;
  error?: string;
}

// Signs the payload the same way GitHub/Stripe do: hex HMAC-SHA256 of the
// raw JSON body, sent as a header, so the receiving DM's server can verify
// the request actually came from Spark and wasn't forged.
export function signWebhookPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// Best-effort, single-attempt delivery — never throws. Re-validates the
// URL immediately before sending (defense against DNS rebinding between
// when the DM saved the webhook and now) rather than trusting that it was
// safe at save time.
export async function deliverWebhook(url: string, secret: string, payload: unknown): Promise<WebhookDeliveryResult> {
  try {
    await validateWebhookUrl(url);
  } catch (err) {
    return { ok: false, error: err instanceof WebhookUrlError ? err.message : "Webhook URL failed validation." };
  }

  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(secret, body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-spark-signature": signature,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `Endpoint responded with HTTP ${res.status}.` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "Request timed out." : "Request failed.";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
