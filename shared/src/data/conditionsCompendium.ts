// Quick-reference condition rules, shared by the in-combat "Condition Rules"
// toggle and the Compendium browse page.

export interface ConditionDef {
  id: string;
  name: string;
  description: string;
}

export const CONDITIONS_COMPENDIUM: ConditionDef[] = [
  { id: "blinded", name: "Blinded", description: "Can't see, and automatically fails any check that requires sight. Attack rolls against the creature have advantage, and its own attack rolls have disadvantage." },
  { id: "charmed", name: "Charmed", description: "Can't attack the charmer or target them with harmful abilities. The charmer has advantage on social ability checks against the creature." },
  { id: "deafened", name: "Deafened", description: "Can't hear, and automatically fails any check that requires hearing." },
  { id: "exhausted", name: "Exhausted", description: "Cumulative levels (1–6) each add a penalty: disadvantage on ability checks, halved speed, disadvantage on attacks and saves, halved max HP, speed reduced to 0, then death." },
  { id: "frightened", name: "Frightened", description: "Disadvantage on ability checks and attack rolls while the source of fear is in sight, and can't willingly move closer to it." },
  { id: "grappled", name: "Grappled", description: "Speed becomes 0. Ends if the grappler is incapacitated or the creature is moved out of the grappler's reach." },
  { id: "incapacitated", name: "Incapacitated", description: "Can't take actions or reactions." },
  { id: "invisible", name: "Invisible", description: "Can't be seen without special senses or magic. Attack rolls against the creature have disadvantage, and its own attack rolls have advantage." },
  { id: "paralyzed", name: "Paralyzed", description: "Incapacitated, can't move or speak. Automatically fails Strength and Dexterity saves. Attacks against it have advantage, and hits from within 5 feet are automatic critical hits." },
  { id: "petrified", name: "Petrified", description: "Transformed to stone, incapacitated, can't move or speak, unaware of surroundings. Resistant to all damage, and immune to poison and disease." },
  { id: "poisoned", name: "Poisoned", description: "Disadvantage on attack rolls and ability checks." },
  { id: "prone", name: "Prone", description: "Can only crawl unless it stands up (costing half its speed). Disadvantage on attack rolls. Attacks against it have advantage from within 5 feet, disadvantage otherwise." },
  { id: "restrained", name: "Restrained", description: "Speed becomes 0. Disadvantage on attack rolls and Dexterity saves. Attacks against it have advantage." },
  { id: "stunned", name: "Stunned", description: "Incapacitated, can't move, and can speak only falteringly. Automatically fails Strength and Dexterity saves. Attacks against it have advantage." },
  { id: "unconscious", name: "Unconscious", description: "Incapacitated, can't move or speak, unaware of surroundings, drops what it's holding, and falls prone. Automatically fails Strength and Dexterity saves. Attacks against it have advantage, and hits from within 5 feet are automatic critical hits." },
];
