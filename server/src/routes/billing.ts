import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { prisma } from "../db.js";

// Stripe access is entirely optional infrastructure — the app must keep
// working for every other feature when it isn't configured yet, so every
// handler below checks for a live client instead of crashing at import time.
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

function resolveOrigin(req: Request): string {
  return req.headers.origin ?? `${req.protocol}://${req.get("host")}`;
}

// Mounted directly on `app`, outside requireAuth and before express.json(),
// since Stripe calls this endpoint directly (not as a logged-in browser) and
// needs the untouched raw body to verify its signature.
export async function billingWebhookHandler(req: Request, res: Response) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send("Billing isn't configured on this server yet.");
  }
  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature as string, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  function customerIdOf(obj: { customer: string | Stripe.Customer | Stripe.DeletedCustomer | null }): string | null {
    if (!obj.customer) return null;
    return typeof obj.customer === "string" ? obj.customer : obj.customer.id;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const customerId = customerIdOf(event.data.object as Stripe.Checkout.Session);
      if (customerId) await prisma.user.updateMany({ where: { stripeCustomerId: customerId }, data: { tier: "paid" } });
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdOf(subscription);
      const tier = subscription.status === "active" || subscription.status === "trialing" ? "paid" : "free";
      if (customerId) await prisma.user.updateMany({ where: { stripeCustomerId: customerId }, data: { tier } });
      break;
    }
    case "customer.subscription.deleted": {
      const customerId = customerIdOf(event.data.object as Stripe.Subscription);
      if (customerId) await prisma.user.updateMany({ where: { stripeCustomerId: customerId }, data: { tier: "free" } });
      break;
    }
  }
  res.json({ received: true });
}

// Everything below is mounted under requireAuth, same as every other router.
export const billingRouter = Router();

function isStaleCustomerError(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing" && err.param === "customer";
}

billingRouter.post("/checkout", async (req, res) => {
  if (!stripe || !process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: "Billing isn't configured on this server yet." });
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Not signed in" });

  async function createCustomer(): Promise<string> {
    const customer = await stripe!.customers.create({ metadata: { userId: user!.id } });
    await prisma.user.update({ where: { id: user!.id }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  async function createSession(customerId: string) {
    const origin = resolveOrigin(req);
    return stripe!.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancel`,
    });
  }

  const customerId = user.stripeCustomerId ?? await createCustomer();

  try {
    const session = await createSession(customerId);
    return res.json({ url: session.url });
  } catch (err) {
    if (!isStaleCustomerError(err)) {
      // Surface Stripe's own message (e.g. a misconfigured Price ID) instead
      // of a generic 500 — this is the kind of error that's actionable for
      // whoever is setting up billing, not a bug to hide from them.
      if (err instanceof Stripe.errors.StripeError) {
        return res.status(502).json({ error: `Stripe rejected the checkout request: ${err.message}` });
      }
      throw err;
    }
    // The stored stripeCustomerId doesn't exist on whatever Stripe account
    // is currently configured (deleted on Stripe's side, or created under a
    // different account/key than what's live now) — self-heal by creating a
    // fresh customer once, rather than leaving the account permanently
    // stuck on checkout.
    try {
      const freshCustomerId = await createCustomer();
      const session = await createSession(freshCustomerId);
      return res.json({ url: session.url });
    } catch (retryErr) {
      if (retryErr instanceof Stripe.errors.StripeError) {
        return res.status(502).json({ error: `Stripe rejected the checkout request: ${retryErr.message}` });
      }
      throw retryErr;
    }
  }
});

billingRouter.post("/portal", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Billing isn't configured on this server yet." });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user?.stripeCustomerId) return res.status(400).json({ error: "No billing account found for this user yet — upgrade first." });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${resolveOrigin(req)}/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    if (isStaleCustomerError(err)) {
      // Nothing to self-heal into here — there's no subscription to manage
      // for a customer Stripe doesn't recognize, so the honest answer is
      // "upgrade again", same message as never having subscribed at all.
      return res.status(400).json({ error: "No billing account found for this user yet — upgrade first." });
    }
    if (err instanceof Stripe.errors.StripeError) {
      return res.status(502).json({ error: `Stripe rejected the portal request: ${err.message}` });
    }
    throw err;
  }
});
