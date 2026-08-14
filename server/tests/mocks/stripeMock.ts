// Manual mock for the "stripe" package, wired up via vi.mock("stripe", ...)
// in billing.test.ts. billing.ts uses both `new Stripe(key)` (instance
// methods) and `Stripe.errors.StripeInvalidRequestError` (static classes),
// so this mock's default export needs to support both.

export class MockStripeError extends Error {}

export class MockStripeInvalidRequestError extends MockStripeError {
  code?: string;
  param?: string;
  constructor(opts: { message: string; code?: string; param?: string }) {
    super(opts.message);
    this.code = opts.code;
    this.param = opts.param;
  }
}

type AnyFn = (...args: any[]) => any;

// Mutable, test-controllable behavior — each billing.test.ts test resets
// this to its default via resetStripeMockState() then overrides just the
// method(s) it needs to behave differently.
export const stripeMockState: {
  createCustomer: AnyFn;
  createCheckoutSession: AnyFn;
  createPortalSession: AnyFn;
  constructEvent: AnyFn;
} = {} as any;

export function resetStripeMockState() {
  let customerCounter = 0;
  stripeMockState.createCustomer = async () => ({ id: `cus_mock_${++customerCounter}` });
  stripeMockState.createCheckoutSession = async () => ({ url: "https://checkout.stripe.com/mock-session" });
  stripeMockState.createPortalSession = async () => ({ url: "https://billing.stripe.com/mock-portal" });
  stripeMockState.constructEvent = (rawBody: Buffer, signature: string) => {
    if (signature !== "test-signature") throw new Error("No signatures found matching the expected signature for payload");
    return JSON.parse(rawBody.toString());
  };
}
resetStripeMockState();

class MockStripe {
  customers = { create: (...args: any[]) => stripeMockState.createCustomer(...args) };
  checkout = { sessions: { create: (...args: any[]) => stripeMockState.createCheckoutSession(...args) } };
  billingPortal = { sessions: { create: (...args: any[]) => stripeMockState.createPortalSession(...args) } };
  webhooks = { constructEvent: (...args: any[]) => stripeMockState.constructEvent(...args) };

  static errors = {
    StripeError: MockStripeError,
    StripeInvalidRequestError: MockStripeInvalidRequestError,
  };
}

export default MockStripe;
