import type { StatBlockTemplate } from "./npcTemplates.js";

const t = (
  id: string,
  name: string,
  challengeRating: string,
  typicalAlignment: string,
  statBlock: StatBlockTemplate["statBlock"]
): StatBlockTemplate => ({ id, name, challengeRating, typicalAlignment, statBlock });

export const MONSTER_TEMPLATES: StatBlockTemplate[] = [
  t("giant-rat", "Giant Rat", "1/8", "Unaligned", {
    size: "Small", creatureType: "beast", armorClass: 12, hitPointsAverage: 7, hitDiceFormula: "2d6",
    speed: "30 ft.", abilityScores: { str: 7, dex: 15, con: 11, int: 2, wis: 10, cha: 4 },
    senses: "darkvision 60 ft., passive Perception 10", languages: "—",
    challengeRating: "1/8", proficiencyBonus: 2, xp: 25,
    traits: [
      { name: "Keen Smell", description: "The rat has advantage on Wisdom (Perception) checks that rely on smell." },
      { name: "Pack Tactics", description: "The rat has advantage on an attack roll against a creature if at least one of the rat's allies is within 5 ft. of the creature and the ally isn't incapacitated." },
    ],
    actions: [{ name: "Bite", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4+2) piercing damage." }],
  }),
  t("kobold", "Kobold", "1/8", "Lawful Evil", {
    size: "Small", creatureType: "humanoid", armorClass: 12, hitPointsAverage: 5, hitDiceFormula: "2d6-2",
    speed: "30 ft.", abilityScores: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
    senses: "darkvision 60 ft., passive Perception 8", languages: "Draconic",
    challengeRating: "1/8", proficiencyBonus: 2, xp: 25,
    traits: [
      { name: "Pack Tactics", description: "The kobold has advantage on an attack roll against a creature if at least one of the kobold's allies is within 5 ft. of the creature and the ally isn't incapacitated." },
      { name: "Sunlight Sensitivity", description: "While in sunlight, the kobold has disadvantage on attack rolls and Wisdom (Perception) checks that rely on sight." },
    ],
    actions: [
      { name: "Dagger", description: "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4+2) piercing damage." },
      { name: "Sling", description: "Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 4 (1d4+2) bludgeoning damage." },
    ],
  }),
  t("goblin", "Goblin", "1/4", "Neutral Evil", {
    size: "Small", creatureType: "humanoid", armorClass: 15, armorClassNote: "leather armor, shield", hitPointsAverage: 7, hitDiceFormula: "2d6",
    speed: "30 ft.", abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    skills: "Stealth +6", senses: "darkvision 60 ft., passive Perception 9", languages: "Common, Goblin",
    challengeRating: "1/4", proficiencyBonus: 2, xp: 50,
    traits: [{ name: "Nimble Escape", description: "The goblin can take the Disengage or Hide action as a bonus action on each of its turns." }],
    actions: [
      { name: "Scimitar", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6+2) slashing damage." },
      { name: "Shortbow", description: "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6+2) piercing damage." },
    ],
  }),
  t("skeleton", "Skeleton", "1/4", "Lawful Evil", {
    size: "Medium", creatureType: "undead", armorClass: 13, armorClassNote: "armor scraps", hitPointsAverage: 13, hitDiceFormula: "2d8+4",
    speed: "30 ft.", abilityScores: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    damageResistances: undefined, damageImmunities: "poison", conditionImmunities: "exhaustion, poisoned",
    senses: "darkvision 60 ft., passive Perception 9", languages: "understands the languages it knew in life but can't speak",
    challengeRating: "1/4", proficiencyBonus: 2, xp: 50,
    traits: [], actions: [
      { name: "Shortsword", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6+2) piercing damage." },
      { name: "Shortbow", description: "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6+2) piercing damage." },
    ],
  }),
  t("zombie", "Zombie", "1/4", "Neutral Evil", {
    size: "Medium", creatureType: "undead", armorClass: 8, hitPointsAverage: 22, hitDiceFormula: "3d8+9",
    speed: "20 ft.", abilityScores: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    savingThrows: "Wis +0", damageImmunities: "poison", conditionImmunities: "poisoned",
    senses: "darkvision 60 ft., passive Perception 8", languages: "understands the languages it knew in life but can't speak",
    challengeRating: "1/4", proficiencyBonus: 2, xp: 50,
    traits: [{ name: "Undead Fortitude", description: "If damage reduces the zombie to 0 hit points, it must make a Constitution saving throw with a DC of 5 + the damage taken, unless the damage is radiant or from a critical hit. On a success, the zombie drops to 1 hit point instead." }],
    actions: [{ name: "Slam", description: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6+1) bludgeoning damage." }],
  }),
  t("wolf", "Wolf", "1/4", "Unaligned", {
    size: "Medium", creatureType: "beast", armorClass: 13, armorClassNote: "natural armor", hitPointsAverage: 11, hitDiceFormula: "2d8+2",
    speed: "40 ft.", abilityScores: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    skills: "Perception +3, Stealth +4", senses: "passive Perception 13", languages: "—",
    challengeRating: "1/4", proficiencyBonus: 2, xp: 50,
    traits: [
      { name: "Keen Hearing and Smell", description: "The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell." },
      { name: "Pack Tactics", description: "The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 ft. of the creature and the ally isn't incapacitated." },
    ],
    actions: [{ name: "Bite", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4+2) piercing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone." }],
  }),
  t("orc", "Orc", "1/2", "Chaotic Evil", {
    size: "Medium", creatureType: "humanoid", armorClass: 13, armorClassNote: "hide armor", hitPointsAverage: 15, hitDiceFormula: "2d8+6",
    speed: "30 ft.", abilityScores: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    skills: "Intimidation +2", senses: "darkvision 60 ft., passive Perception 10", languages: "Common, Orc",
    challengeRating: "1/2", proficiencyBonus: 2, xp: 100,
    traits: [{ name: "Aggressive", description: "As a bonus action, the orc can move up to its speed toward a hostile creature that it can see." }],
    actions: [
      { name: "Greataxe", description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12+3) slashing damage." },
      { name: "Javelin", description: "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 6 (1d6+3) piercing damage." },
    ],
  }),
  t("hobgoblin", "Hobgoblin", "1/2", "Lawful Evil", {
    size: "Medium", creatureType: "humanoid", armorClass: 18, armorClassNote: "chain mail, shield", hitPointsAverage: 11, hitDiceFormula: "2d8+2",
    speed: "30 ft.", abilityScores: { str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9 },
    senses: "darkvision 60 ft., passive Perception 10", languages: "Common, Goblin",
    challengeRating: "1/2", proficiencyBonus: 2, xp: 100,
    traits: [{ name: "Martial Advantage", description: "Once per turn, the hobgoblin can deal an extra 7 (2d6) damage to a creature it hits with a weapon attack if that creature is within 5 ft. of an ally of the hobgoblin that isn't incapacitated." }],
    actions: [
      { name: "Longsword", description: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8+1) slashing damage, or 6 (1d10+1) if used with two hands." },
      { name: "Longbow", description: "Ranged Weapon Attack: +3 to hit, range 150/600 ft., one target. Hit: 5 (1d8+1) piercing damage." },
    ],
  }),
  t("gnoll", "Gnoll", "1/2", "Chaotic Evil", {
    size: "Medium", creatureType: "humanoid", armorClass: 15, armorClassNote: "hide armor, shield", hitPointsAverage: 22, hitDiceFormula: "5d8",
    speed: "30 ft.", abilityScores: { str: 14, dex: 12, con: 11, int: 6, wis: 10, cha: 7 },
    senses: "darkvision 60 ft., passive Perception 10", languages: "Gnoll",
    challengeRating: "1/2", proficiencyBonus: 2, xp: 100,
    traits: [{ name: "Rampage", description: "When the gnoll reduces a creature to 0 hit points with a melee attack on its turn, the gnoll can take a bonus action to move up to half its speed and make a bite attack." }],
    actions: [
      { name: "Bite", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4+2) piercing damage." },
      { name: "Spear", description: "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 5 (1d6+2) piercing damage, or 6 (1d8+2) if used with two hands." },
      { name: "Longbow", description: "Ranged Weapon Attack: +3 to hit, range 150/600 ft., one target. Hit: 5 (1d8+1) piercing damage." },
    ],
  }),
  t("ghoul", "Ghoul", "1", "Chaotic Evil", {
    size: "Medium", creatureType: "undead", armorClass: 12, hitPointsAverage: 22, hitDiceFormula: "5d8",
    speed: "30 ft.", abilityScores: { str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6 },
    damageImmunities: "poison", conditionImmunities: "charmed, exhaustion, poisoned",
    senses: "darkvision 60 ft., passive Perception 10", languages: "Common",
    challengeRating: "1", proficiencyBonus: 2, xp: 200,
    traits: [], actions: [
      { name: "Bite", description: "Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 9 (2d6+2) piercing damage." },
      { name: "Claws", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4+2) slashing damage. If the target is not undead, it must succeed on a DC 10 Constitution saving throw or be paralyzed for 1 minute." },
    ],
  }),
  t("ogre", "Ogre", "2", "Chaotic Evil", {
    size: "Large", creatureType: "giant", armorClass: 11, armorClassNote: "hide armor", hitPointsAverage: 59, hitDiceFormula: "7d10+21",
    speed: "40 ft.", abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    senses: "darkvision 60 ft., passive Perception 8", languages: "Common, Giant",
    challengeRating: "2", proficiencyBonus: 2, xp: 450,
    traits: [], actions: [
      { name: "Greatclub", description: "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8+4) bludgeoning damage." },
      { name: "Javelin", description: "Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 11 (2d6+4) piercing damage." },
    ],
  }),
  t("gelatinous-cube", "Gelatinous Cube", "2", "Unaligned", {
    size: "Large", creatureType: "ooze", armorClass: 6, hitPointsAverage: 84, hitDiceFormula: "16d10",
    speed: "15 ft.", abilityScores: { str: 14, dex: 3, con: 20, int: 1, wis: 6, cha: 1 },
    damageImmunities: "acid, cold, lightning", conditionImmunities: "blinded, charmed, deafened, exhaustion, frightened, prone",
    senses: "blindsight 60 ft. (blind beyond this radius), passive Perception 8", languages: "—",
    challengeRating: "2", proficiencyBonus: 2, xp: 450,
    traits: [{ name: "Transparent", description: "Even when the cube is in plain sight, it takes a successful DC 15 Wisdom (Perception) check to spot a cube that hasn't moved or attacked. A creature that tries to enter the cube's space while unaware of the cube is surprised by the cube." }],
    actions: [{ name: "Pseudopod", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 10 (3d6) acid damage. Engulf: the cube moves up to its speed, and a Medium or smaller creature in its path can be engulfed on a failed DC 12 Dexterity save, taking 10 (3d6) acid damage and being trapped until it escapes." }],
  }),
  t("owlbear", "Owlbear", "3", "Unaligned", {
    size: "Large", creatureType: "monstrosity", armorClass: 13, armorClassNote: "natural armor", hitPointsAverage: 59, hitDiceFormula: "7d10+21",
    speed: "40 ft.", abilityScores: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    skills: "Perception +3", senses: "darkvision 60 ft., passive Perception 13", languages: "—",
    challengeRating: "3", proficiencyBonus: 2, xp: 700,
    traits: [{ name: "Keen Sight and Smell", description: "The owlbear has advantage on Wisdom (Perception) checks that rely on sight or smell." }],
    actions: [
      { name: "Multiattack", description: "The owlbear makes two attacks: one with its beak and one with its claws." },
      { name: "Beak", description: "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 10 (1d10+5) piercing damage." },
      { name: "Claws", description: "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8+5) slashing damage." },
    ],
  }),
  t("manticore", "Manticore", "3", "Lawful Evil", {
    size: "Large", creatureType: "monstrosity", armorClass: 14, armorClassNote: "natural armor", hitPointsAverage: 68, hitDiceFormula: "8d10+24",
    speed: "30 ft., fly 50 ft.", abilityScores: { str: 17, dex: 16, con: 17, int: 7, wis: 12, cha: 8 },
    senses: "darkvision 60 ft., passive Perception 11", languages: "Common",
    challengeRating: "3", proficiencyBonus: 2, xp: 700,
    traits: [], actions: [
      { name: "Multiattack", description: "The manticore makes three attacks: one with its bite and two with its claws, or two with its tail spikes." },
      { name: "Bite", description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8+3) piercing damage." },
      { name: "Claw", description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6+3) slashing damage." },
      { name: "Tail Spike", description: "Ranged Weapon Attack: +5 to hit, range 100/200 ft., one target. Hit: 7 (1d8+3) piercing damage." },
    ],
  }),
  t("displacer-beast", "Displacer Beast", "3", "Lawful Evil", {
    size: "Large", creatureType: "monstrosity", armorClass: 13, armorClassNote: "natural armor", hitPointsAverage: 85, hitDiceFormula: "10d10+30",
    speed: "40 ft.", abilityScores: { str: 18, dex: 15, con: 18, int: 6, wis: 12, cha: 8 },
    senses: "darkvision 60 ft., passive Perception 11", languages: "—",
    challengeRating: "3", proficiencyBonus: 2, xp: 700,
    traits: [{ name: "Displacement", description: "The beast projects a magical illusion that makes it appear to be standing near its actual location, causing attack rolls against it to have disadvantage. If the beast is hit, this trait is disrupted until the end of its next turn." }],
    actions: [
      { name: "Multiattack", description: "The beast makes two tentacle attacks." },
      { name: "Tentacle", description: "Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 10 (2d6+3) bludgeoning damage." },
    ],
  }),
  t("troll", "Troll", "5", "Chaotic Evil", {
    size: "Large", creatureType: "giant", armorClass: 15, armorClassNote: "natural armor", hitPointsAverage: 84, hitDiceFormula: "8d10+40",
    speed: "30 ft.", abilityScores: { str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7 },
    skills: "Perception +2", senses: "darkvision 60 ft., passive Perception 12", languages: "Giant",
    challengeRating: "5", proficiencyBonus: 3, xp: 1800,
    traits: [
      { name: "Keen Smell", description: "The troll has advantage on Wisdom (Perception) checks that rely on smell." },
      { name: "Regeneration", description: "The troll regains 10 hit points at the start of its turn unless it has taken acid or fire damage since its last turn. If reduced to 0 hit points, it dies only if it doesn't regenerate." },
    ],
    actions: [
      { name: "Multiattack", description: "The troll makes three attacks: one with its bite and two with its claws." },
      { name: "Bite", description: "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 7 (1d6+4) piercing damage." },
      { name: "Claw", description: "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6+4) slashing damage." },
    ],
  }),
  t("werewolf", "Werewolf", "3", "Chaotic Evil", {
    size: "Medium", creatureType: "humanoid (shapechanger)", armorClass: 11, armorClassNote: "12 in wolf form", hitPointsAverage: 58, hitDiceFormula: "9d8+18",
    speed: "30 ft. (40 ft. in wolf form)", abilityScores: { str: 15, dex: 13, con: 14, int: 10, wis: 11, cha: 10 },
    skills: "Perception +4, Stealth +3", damageResistances: "bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons",
    senses: "passive Perception 14", languages: "Common (can't speak in wolf form)",
    challengeRating: "3", proficiencyBonus: 2, xp: 700,
    traits: [
      { name: "Shapechanger", description: "The werewolf can use its action to polymorph into a wolf-humanoid hybrid or into a wolf, and back into its true form, which is humanoid." },
      { name: "Keen Hearing and Smell", description: "The werewolf has advantage on Wisdom (Perception) checks that rely on hearing or smell." },
    ],
    actions: [
      { name: "Multiattack (humanoid form)", description: "The werewolf makes two attacks: one with its bite and one with its spear, or two with its spear." },
      { name: "Bite", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8+2) piercing damage. If the target is a humanoid, it must succeed on a DC 12 Constitution saving throw or be cursed with werewolf lycanthropy." },
      { name: "Claw (wolf/hybrid form only)", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4+2) slashing damage." },
      { name: "Spear (humanoid/hybrid form only)", description: "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d6+3) piercing damage, or 7 (1d8+3) if used with two hands." },
    ],
  }),
];
