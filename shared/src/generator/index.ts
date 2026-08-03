import { RACES } from "../data/races.js";
import { BACKGROUNDS } from "../data/backgrounds.js";
import { ALIGNMENTS } from "../data/alignments.js";
import { NPC_TEMPLATES } from "../data/npcTemplates.js";
import { MONSTER_TEMPLATES } from "../data/monsterTemplates.js";
import { nameListFor, MONSTER_FIRST_NAMES, MONSTER_EPITHETS } from "../data/names.js";
import {
  PERSONALITY_TRAITS, IDEALS, BONDS, FLAWS, MANNERISMS, APPEARANCE_DETAILS,
  MOTIVATIONS, SECRETS, MONSTER_MOTIVATIONS, MONSTER_DISTINGUISHING_FEATURES,
} from "../data/flavor.js";
import type { GenerateRequest, GeneratedCharacter, CharacterKind, Backstory } from "../types.js";
import { pick } from "./random.js";

const CHARACTER_KINDS: CharacterKind[] = ["npc", "monster"];

function resolveKind(request: GenerateRequest): CharacterKind {
  if (request.fullyRandom || !request.kind || request.kind === "random") {
    return pick(CHARACTER_KINDS);
  }
  return request.kind;
}

function resolveTemplate(kind: CharacterKind, request: GenerateRequest) {
  const pool = kind === "npc" ? NPC_TEMPLATES : MONSTER_TEMPLATES;
  if (!request.fullyRandom && request.templateId) {
    const found = pool.find((tpl) => tpl.id === request.templateId);
    if (found) return found;
  }
  if (!request.fullyRandom && request.challengeRating) {
    const matches = pool.filter((tpl) => tpl.challengeRating === request.challengeRating);
    if (matches.length > 0) return pick(matches);
  }
  return pick(pool);
}

function resolveAlignment(typicalAlignment: string, request: GenerateRequest): string {
  if (!request.fullyRandom && request.alignment) return request.alignment;
  if (!request.fullyRandom && !typicalAlignment.toLowerCase().startsWith("any")) {
    return typicalAlignment;
  }
  return pick(ALIGNMENTS);
}

function generateNpcName(raceId: string): string {
  const { first, last } = nameListFor(raceId);
  return `${pick(first)} ${pick(last)}`;
}

function generateMonsterName(): string {
  return `${pick(MONSTER_FIRST_NAMES)} ${pick(MONSTER_EPITHETS)}`;
}

function buildNpcBackstory(templateName: string, backgroundName: string | undefined): Backstory {
  return {
    occupationOrRole: backgroundName ? `${templateName} (formerly a ${backgroundName})` : templateName,
    personalityTrait: pick(PERSONALITY_TRAITS),
    ideal: pick(IDEALS),
    bond: pick(BONDS),
    flaw: pick(FLAWS),
    appearance: pick(APPEARANCE_DETAILS),
    mannerism: pick(MANNERISMS),
    motivation: pick(MOTIVATIONS),
    secret: pick(SECRETS),
  };
}

function buildMonsterBackstory(templateName: string): Backstory {
  return {
    occupationOrRole: templateName,
    personalityTrait: "",
    ideal: "",
    bond: "",
    flaw: "",
    appearance: pick(MONSTER_DISTINGUISHING_FEATURES),
    mannerism: "",
    motivation: pick(MONSTER_MOTIVATIONS),
    secret: "",
  };
}

export function generateCharacter(request: GenerateRequest = {}): GeneratedCharacter {
  const kind = resolveKind(request);
  const template = resolveTemplate(kind, request);
  const alignment = resolveAlignment(template.typicalAlignment, request);
  const statBlock = { ...template.statBlock, alignment };

  if (kind === "npc") {
    const race = !request.fullyRandom && request.race
      ? RACES.find((r) => r.id === request.race) ?? pick(RACES)
      : pick(RACES);
    const background = !request.fullyRandom && request.background
      ? BACKGROUNDS.find((b) => b.id === request.background)
      : pick(BACKGROUNDS);
    const name = !request.fullyRandom && request.name ? request.name : generateNpcName(race.id);

    return {
      kind,
      name,
      race: race.name,
      background: background?.name,
      alignment,
      templateId: template.id,
      templateName: template.name,
      statBlock,
      backstory: buildNpcBackstory(template.name, background?.name),
    };
  }

  const name = !request.fullyRandom && request.name ? request.name : generateMonsterName();
  return {
    kind,
    name,
    alignment,
    templateId: template.id,
    templateName: template.name,
    statBlock,
    backstory: buildMonsterBackstory(template.name),
  };
}
