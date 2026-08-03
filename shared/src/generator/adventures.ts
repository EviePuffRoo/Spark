import {
  ADVENTURE_TITLE_ADJECTIVES, ADVENTURE_TITLE_NOUNS,
  ADVENTURE_PREMISES, ADVENTURE_HOOKS, ADVENTURE_OBJECTIVES, ADVENTURE_COMPLICATIONS, ADVENTURE_REWARDS,
} from "../data/adventures.js";
import { QUEST_TIERS } from "../data/quests.js";
import { pick } from "./random.js";
import type { GenerateAdventureRequest, GeneratedAdventure, AdventureCastNames } from "../types.js";

function fillTemplate(template: string, cast: AdventureCastNames): string {
  const filled = template
    .replace(/\{questGiver\}/g, cast.questGiverName ?? "a local contact")
    .replace(/\{antagonist\}/g, cast.antagonistName ?? "a hidden rival")
    .replace(/\{startLocation\}/g, cast.startLocationName ?? "a nearby settlement")
    .replace(/\{climaxLocation\}/g, cast.climaxLocationName ?? "wherever the trail ends")
    .replace(/\{reward\}/g, cast.rewardName ?? "a fitting reward");
  // Fallback nouns are written lowercase to read naturally mid-sentence, but a
  // template can also place one at the very start - capitalize it there.
  return filled.charAt(0).toUpperCase() + filled.slice(1);
}

export function composeAdventure(request: GenerateAdventureRequest): GeneratedAdventure {
  const tier =
    !request.fullyRandom && request.tier && QUEST_TIERS.includes(request.tier)
      ? request.tier
      : pick(QUEST_TIERS);

  const generatedTitle = `The ${pick(ADVENTURE_TITLE_ADJECTIVES)} ${pick(ADVENTURE_TITLE_NOUNS)}`;
  const title = !request.fullyRandom && request.title ? request.title : generatedTitle;

  const cast = request.cast ?? {};

  return {
    title,
    tier,
    premise: fillTemplate(pick(ADVENTURE_PREMISES), cast),
    hook: fillTemplate(pick(ADVENTURE_HOOKS), cast),
    objective: fillTemplate(pick(ADVENTURE_OBJECTIVES), cast),
    complication: fillTemplate(pick(ADVENTURE_COMPLICATIONS), cast),
    reward: fillTemplate(pick(ADVENTURE_REWARDS), cast),
  };
}
