import { CONDITIONS_COMPENDIUM } from "./data/conditionsCompendium.js";
import { RULES_REFERENCE } from "./data/rulesReference.js";

export interface GlossaryEntry {
  term: string;
  description: string;
}

// Terms the client auto-links to their definition wherever generated combat
// text renders (stat block traits/actions, spell descriptions, lair
// actions) — a monster or spell constantly says things like "or be
// poisoned" or "grants three-quarters cover" without ever explaining what
// that means. Deliberately excludes RULES_REFERENCE's single common-word
// actions (Attack, Dash, Help, Hide, Ready, Search, ...): those appear in
// nearly every line of generated combat prose, and auto-linking every one
// would bury the handful of terms actually worth a lookup under a wall of
// underlines instead of highlighting them. Kept to conditions (distinctive,
// sparse per paragraph) plus a couple of equally distinctive multi-word
// rule phrases.
const LINKABLE_RULE_IDS = new Set(["action-opportunity-attack", "cover-half", "cover-three-quarters", "cover-total"]);

export const RULES_GLOSSARY: GlossaryEntry[] = [
  ...CONDITIONS_COMPENDIUM.map((c) => ({ term: c.name, description: c.description })),
  ...RULES_REFERENCE.filter((r) => LINKABLE_RULE_IDS.has(r.id)).map((r) => ({ term: r.name, description: r.description })),
];
