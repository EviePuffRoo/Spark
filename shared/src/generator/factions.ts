import {
  FACTION_TYPES, FACTION_NAME_ADJECTIVES, FACTION_NAME_NOUNS,
  FACTION_AGENDAS, FACTION_METHODS, FACTION_PUBLIC_FACES, FACTION_HOOKS,
} from "../data/factions.js";
import { pick } from "./random.js";
import type { GenerateFactionRequest, GeneratedFaction } from "../types.js";

export function generateFaction(request: GenerateFactionRequest = {}): GeneratedFaction {
  const factionType =
    !request.fullyRandom && request.factionType && FACTION_TYPES.includes(request.factionType)
      ? request.factionType
      : pick(FACTION_TYPES);

  const generatedName = `The ${pick(FACTION_NAME_ADJECTIVES)} ${pick(FACTION_NAME_NOUNS)}`;
  const name = !request.fullyRandom && request.name ? request.name : generatedName;

  return {
    name,
    factionType,
    agenda: pick(FACTION_AGENDAS),
    methods: pick(FACTION_METHODS),
    publicFace: pick(FACTION_PUBLIC_FACES),
    hook: pick(FACTION_HOOKS),
  };
}
