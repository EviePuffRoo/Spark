import {
  QUEST_TYPES, QUEST_TIERS, QUEST_TITLE_ADJECTIVES, QUEST_TITLE_NOUNS,
  QUEST_HOOKS, QUEST_OBJECTIVES, QUEST_COMPLICATIONS, QUEST_REWARDS,
} from "../data/quests.js";
import { pick } from "./random.js";
import type { GenerateQuestHookRequest, GeneratedQuestHook } from "../types.js";

export function generateQuestHook(request: GenerateQuestHookRequest = {}): GeneratedQuestHook {
  const questType =
    !request.fullyRandom && request.questType && QUEST_TYPES.includes(request.questType)
      ? request.questType
      : pick(QUEST_TYPES);

  const tier =
    !request.fullyRandom && request.tier && QUEST_TIERS.includes(request.tier)
      ? request.tier
      : pick(QUEST_TIERS);

  const generatedTitle = `The ${pick(QUEST_TITLE_ADJECTIVES)} ${pick(QUEST_TITLE_NOUNS)}`;
  const title = !request.fullyRandom && request.title ? request.title : generatedTitle;

  return {
    title,
    questType,
    tier,
    hook: pick(QUEST_HOOKS),
    objective: pick(QUEST_OBJECTIVES),
    complication: pick(QUEST_COMPLICATIONS),
    reward: pick(QUEST_REWARDS),
  };
}
