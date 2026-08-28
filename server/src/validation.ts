import type { z } from "zod";

// Lenient, never-throw parsing helpers matching this codebase's existing
// coerce* convention across the route handlers: malformed input is
// silently dropped or defaulted rather than rejected with a 400, since a
// write route here has always treated "save what's well-formed, discard
// what isn't" as the desired behavior for nested nice-to-have fields (the
// handler's own top-level required-field checks are what actually reject
// a bad request outright). These two helpers are the zod-schema-driven
// replacement for that same pattern, used in place of hand-written
// per-field `typeof x === "..."` coercion functions.

// One item that fails validation is dropped; valid items are kept — same
// as the old `arr.map(coerceX).filter((x): x is X => x !== null)` pattern.
export function parseArray<T>(schema: z.ZodType<T>, raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

// Malformed or absent input becomes undefined rather than a parse error —
// same as the old `coerceX(raw): X | undefined` pattern for an optional
// nested object field.
export function parseOptional<T>(schema: z.ZodType<T>, raw: unknown): T | undefined {
  const result = schema.safeParse(raw);
  return result.success ? result.data : undefined;
}
