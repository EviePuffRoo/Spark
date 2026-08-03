export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type AbilityScores = Record<AbilityKey, number>;

export interface StatBlockAction {
  name: string;
  description: string;
}

export interface StatBlock {
  size: string;
  creatureType: string;
  alignment: string;
  armorClass: number;
  armorClassNote?: string;
  hitPointsAverage: number;
  hitDiceFormula: string;
  speed: string;
  abilityScores: AbilityScores;
  savingThrows?: string;
  skills?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses: string;
  languages: string;
  challengeRating: string;
  proficiencyBonus: number;
  xp: number;
  traits: StatBlockAction[];
  actions: StatBlockAction[];
  reactions?: StatBlockAction[];
}

export interface Backstory {
  occupationOrRole: string;
  personalityTrait: string;
  ideal: string;
  bond: string;
  flaw: string;
  appearance: string;
  mannerism: string;
  motivation: string;
  secret: string;
}

export type CharacterKind = "npc" | "monster";

export interface Character {
  id: string;
  kind: CharacterKind;
  name: string;
  race?: string;
  background?: string;
  alignment: string;
  templateId: string;
  templateName: string;
  statBlock: StatBlock;
  backstory: Backstory;
  worldId?: string | null;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface World {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateRequest {
  kind?: CharacterKind | "random";
  race?: string;
  templateId?: string;
  challengeRating?: string;
  background?: string;
  alignment?: string;
  name?: string;
  fullyRandom?: boolean;
}

export interface GeneratedCharacter {
  kind: CharacterKind;
  name: string;
  race?: string;
  background?: string;
  alignment: string;
  templateId: string;
  templateName: string;
  statBlock: StatBlock;
  backstory: Backstory;
}

export interface GeneratedItem {
  name: string;
  itemType: string;
  category: string;
  rarity: string;
  description: string;
  property: string;
  history: string;
}

export interface Item extends GeneratedItem {
  id: string;
  worldId?: string | null;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateItemRequest {
  category?: string;
  rarity?: string;
  name?: string;
  fullyRandom?: boolean;
}

export interface GeneratedLocation {
  name: string;
  locationType: string;
  category: string;
  description: string;
  notableFeature: string;
  keeper: string;
  rumor: string;
}

export interface Location extends GeneratedLocation {
  id: string;
  worldId?: string | null;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateLocationRequest {
  category?: string;
  name?: string;
  fullyRandom?: boolean;
}

export interface GeneratedQuestHook {
  title: string;
  questType: string;
  tier: string;
  hook: string;
  objective: string;
  complication: string;
  reward: string;
}

export interface QuestHook extends GeneratedQuestHook {
  id: string;
  worldId?: string | null;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateQuestHookRequest {
  questType?: string;
  tier?: string;
  title?: string;
  fullyRandom?: boolean;
}
