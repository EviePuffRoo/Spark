import type { StatBlock } from "../types.js";

export interface StatBlockTemplate {
  id: string;
  name: string;
  challengeRating: string;
  typicalAlignment: string;
  statBlock: Omit<StatBlock, "alignment">;
}

const t = (
  id: string,
  name: string,
  challengeRating: string,
  typicalAlignment: string,
  statBlock: Omit<StatBlock, "alignment">
): StatBlockTemplate => ({ id, name, challengeRating, typicalAlignment, statBlock });

export const NPC_TEMPLATES: StatBlockTemplate[] = [
  t("commoner", "Commoner", "0", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 10, hitPointsAverage: 4, hitDiceFormula: "1d8",
    speed: "30 ft.", abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    senses: "passive Perception 10", languages: "any one language (usually Common)",
    challengeRating: "0", proficiencyBonus: 2, xp: 10,
    traits: [], actions: [{ name: "Club", description: "Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage." }],
  }),
  t("guard", "Guard", "1/8", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 16, armorClassNote: "chain shirt, shield", hitPointsAverage: 11, hitDiceFormula: "2d8+2",
    speed: "30 ft.", abilityScores: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
    skills: "Perception +2", senses: "passive Perception 12", languages: "any one language (usually Common)",
    challengeRating: "1/8", proficiencyBonus: 2, xp: 25,
    traits: [], actions: [{ name: "Spear", description: "Melee or Ranged Weapon Attack: +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6+1) piercing damage, or 5 (1d8+1) if used with two hands to make a melee attack." }],
  }),
  t("scout", "Scout", "1/2", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 13, armorClassNote: "leather armor", hitPointsAverage: 16, hitDiceFormula: "3d8+3",
    speed: "30 ft.", abilityScores: { str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11 },
    skills: "Nature +4, Perception +5, Stealth +6, Survival +5", senses: "passive Perception 15", languages: "any one language (usually Common)",
    challengeRating: "1/2", proficiencyBonus: 2, xp: 100,
    traits: [], actions: [
      { name: "Multiattack", description: "The scout makes two melee attacks or two ranged attacks." },
      { name: "Shortsword", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6+2) piercing damage." },
      { name: "Longbow", description: "Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 6 (1d8+2) piercing damage." },
    ],
  }),
  t("thug", "Thug", "1/2", "Any non-good alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 11, armorClassNote: "leather armor", hitPointsAverage: 32, hitDiceFormula: "5d8+10",
    speed: "30 ft.", abilityScores: { str: 15, dex: 11, con: 14, int: 10, wis: 10, cha: 11 },
    skills: "Intimidation +2", senses: "passive Perception 10", languages: "any one language (usually Common)",
    challengeRating: "1/2", proficiencyBonus: 2, xp: 100,
    traits: [{ name: "Pack Tactics", description: "The thug has advantage on an attack roll against a creature if at least one of the thug's allies is within 5 ft. of the creature and the ally isn't incapacitated." }],
    actions: [
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      { name: "Mace", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6+2) bludgeoning damage." },
      { name: "Heavy Crossbow", description: "Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage." },
    ],
  }),
  t("spy", "Spy", "1", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 12, hitPointsAverage: 27, hitDiceFormula: "6d8",
    speed: "30 ft.", abilityScores: { str: 10, dex: 15, con: 10, int: 12, wis: 14, cha: 16 },
    skills: "Deception +5, Insight +4, Investigation +3, Perception +4, Persuasion +5, Sleight of Hand +4, Stealth +4",
    senses: "passive Perception 14", languages: "any two languages",
    challengeRating: "1", proficiencyBonus: 2, xp: 200,
    traits: [], actions: [
      { name: "Multiattack", description: "The spy makes two melee attacks." },
      { name: "Shortsword", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6+2) piercing damage." },
      { name: "Hand Crossbow", description: "Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 5 (1d6+2) piercing damage." },
    ],
  }),
  t("bandit-captain", "Bandit Captain", "2", "Any non-lawful alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 15, armorClassNote: "studded leather", hitPointsAverage: 65, hitDiceFormula: "10d8+20",
    speed: "30 ft.", abilityScores: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    skills: "Athletics +4, Deception +4", senses: "passive Perception 10", languages: "any two languages",
    challengeRating: "2", proficiencyBonus: 2, xp: 450,
    traits: [], actions: [
      { name: "Multiattack", description: "The captain makes three melee attacks: two with its scimitar and one with its dagger, or two with its dagger." },
      { name: "Scimitar", description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6+3) slashing damage." },
      { name: "Dagger", description: "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 5 (1d4+3) piercing damage." },
    ],
  }),
  t("cultist", "Cultist", "1/8", "Any non-good alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 12, armorClassNote: "leather armor", hitPointsAverage: 9, hitDiceFormula: "2d8",
    speed: "30 ft.", abilityScores: { str: 11, dex: 12, con: 10, int: 10, wis: 11, cha: 10 },
    skills: "Deception +2, Religion +2", senses: "passive Perception 10", languages: "any one language (usually Common)",
    challengeRating: "1/8", proficiencyBonus: 2, xp: 25,
    traits: [{ name: "Dark Devotion", description: "The cultist has advantage on saving throws against being charmed or frightened." }],
    actions: [{ name: "Scimitar", description: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6+1) slashing damage." }],
  }),
  t("cult-fanatic", "Cult Fanatic", "2", "Any non-good alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 13, armorClassNote: "leather armor", hitPointsAverage: 33, hitDiceFormula: "6d8+6",
    speed: "30 ft.", abilityScores: { str: 11, dex: 14, con: 12, int: 10, wis: 13, cha: 14 },
    skills: "Deception +4, Persuasion +4, Religion +2", senses: "passive Perception 11", languages: "any one language (usually Common)",
    challengeRating: "2", proficiencyBonus: 2, xp: 450,
    traits: [
      { name: "Dark Devotion", description: "The fanatic has advantage on saving throws against being charmed or frightened." },
      { name: "Spellcasting", description: "The fanatic is a 4th-level spellcaster (spell save DC 11). Cantrips: light, sacred flame, thaumaturgy. 1st level: command, inflict wounds, shield of faith. 2nd level: hold person, spiritual weapon." },
    ],
    actions: [
      { name: "Multiattack", description: "The fanatic makes two melee attacks." },
      { name: "Dagger", description: "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4+2) piercing damage." },
    ],
  }),
  t("acolyte", "Acolyte", "1/4", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 10, hitPointsAverage: 9, hitDiceFormula: "2d8",
    speed: "30 ft.", abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 11 },
    skills: "Medicine +4, Religion +2", senses: "passive Perception 12", languages: "any one language (usually Common)",
    challengeRating: "1/4", proficiencyBonus: 2, xp: 50,
    traits: [{ name: "Spellcasting", description: "The acolyte is a 1st-level spellcaster (spell save DC 12). Cantrips: light, sacred flame, thaumaturgy. 1st level: bless, cure wounds, sanctuary." }],
    actions: [{ name: "Club", description: "Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 (1d4-1) bludgeoning damage." }],
  }),
  t("noble", "Noble", "1/8", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 15, armorClassNote: "breastplate", hitPointsAverage: 9, hitDiceFormula: "2d8",
    speed: "30 ft.", abilityScores: { str: 11, dex: 12, con: 11, int: 12, wis: 14, cha: 16 },
    skills: "Deception +5, Insight +4, Persuasion +5", senses: "passive Perception 12", languages: "any one language (usually Common)",
    challengeRating: "1/8", proficiencyBonus: 2, xp: 25,
    traits: [], actions: [{ name: "Rapier", description: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8+1) piercing damage." }],
  }),
  t("knight", "Knight", "3", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 18, armorClassNote: "plate", hitPointsAverage: 52, hitDiceFormula: "8d8+16",
    speed: "30 ft.", abilityScores: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 },
    savingThrows: "Con +4, Wis +2", senses: "passive Perception 10", languages: "any one language (usually Common)",
    challengeRating: "3", proficiencyBonus: 2, xp: 700,
    traits: [{ name: "Brave", description: "The knight has advantage on saving throws against being frightened." }],
    actions: [
      { name: "Multiattack", description: "The knight makes two melee attacks." },
      { name: "Greatsword", description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6+3) slashing damage." },
      { name: "Heavy Crossbow", description: "Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage." },
    ],
  }),
  t("veteran", "Veteran", "3", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 17, armorClassNote: "splint", hitPointsAverage: 58, hitDiceFormula: "9d8+18",
    speed: "30 ft.", abilityScores: { str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10 },
    skills: "Athletics +5, Perception +3", senses: "passive Perception 13", languages: "any one language (usually Common)",
    challengeRating: "3", proficiencyBonus: 2, xp: 700,
    traits: [], actions: [
      { name: "Multiattack", description: "The veteran makes two longsword attacks. If it has a shortsword drawn, it can also make a shortsword attack." },
      { name: "Longsword", description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8+3) slashing damage, or 8 (1d10+3) if used with two hands." },
      { name: "Shortsword", description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6+3) piercing damage." },
      { name: "Heavy Crossbow", description: "Ranged Weapon Attack: +3 to hit, range 100/400 ft., one target. Hit: 6 (1d10+1) piercing damage." },
    ],
  }),
  t("mage", "Mage", "6", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 12, armorClassNote: "15 with mage armor active", hitPointsAverage: 40, hitDiceFormula: "9d8",
    speed: "30 ft.", abilityScores: { str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11 },
    savingThrows: "Int +6, Wis +5", skills: "Arcana +6, History +6", senses: "passive Perception 11", languages: "any four languages",
    challengeRating: "6", proficiencyBonus: 3, xp: 2300,
    traits: [{ name: "Spellcasting", description: "The mage is a 9th-level spellcaster (spell save DC 14). Cantrips: fire bolt, light, mage hand, prestidigitation. Prepared spells include: magic missile, shield, mage armor, misty step, counterspell, fireball, fly." }],
    actions: [{ name: "Dagger", description: "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4+2) piercing damage." }],
  }),
  t("priest", "Priest", "2", "Any alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 13, armorClassNote: "chain shirt", hitPointsAverage: 27, hitDiceFormula: "5d8+5",
    speed: "25 ft.", abilityScores: { str: 10, dex: 10, con: 12, int: 13, wis: 16, cha: 13 },
    skills: "Medicine +5, Persuasion +3, Religion +4", senses: "passive Perception 13", languages: "any two languages",
    challengeRating: "2", proficiencyBonus: 2, xp: 450,
    traits: [
      { name: "Divine Eminence", description: "As a bonus action, the priest can expend a spell slot to cause its melee weapon attacks to deal an extra 10 (3d6) radiant damage on a hit." },
      { name: "Spellcasting", description: "The priest is a 5th-level spellcaster (spell save DC 13). Cantrips: light, sacred flame, thaumaturgy. Prepared spells include: cure wounds, guiding bolt, healing word, dispel magic, spirit guardians." },
    ],
    actions: [{ name: "Mace", description: "Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 3 (1d6) bludgeoning damage." }],
  }),
  t("assassin", "Assassin", "8", "Any non-good alignment", {
    size: "Medium", creatureType: "humanoid", armorClass: 15, armorClassNote: "studded leather", hitPointsAverage: 78, hitDiceFormula: "12d8+24",
    speed: "30 ft.", abilityScores: { str: 11, dex: 16, con: 14, int: 13, wis: 11, cha: 10 },
    savingThrows: "Dex +6, Int +4", skills: "Acrobatics +6, Deception +3, Perception +4, Stealth +9",
    senses: "passive Perception 14", languages: "thieves' cant plus any two languages",
    challengeRating: "8", proficiencyBonus: 3, xp: 3900,
    traits: [
      { name: "Assassinate", description: "During its first turn, the assassin has advantage on attack rolls against any creature that hasn't taken a turn. Any hit the assassin scores against a surprised creature is a critical hit." },
      { name: "Evasion", description: "If the assassin is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, it instead takes no damage on a success and only half on a failure." },
    ],
    actions: [
      { name: "Multiattack", description: "The assassin makes two shortsword attacks." },
      { name: "Shortsword", description: "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 6 (1d6+3) piercing damage, and the target must make a DC 15 Constitution saving throw, taking 24 (7d6) poison damage on a failed save, or half as much on a success." },
      { name: "Light Crossbow", description: "Ranged Weapon Attack: +6 to hit, range 80/320 ft., one target. Hit: 7 (1d8+3) piercing damage, plus the poison above." },
    ],
  }),
];
