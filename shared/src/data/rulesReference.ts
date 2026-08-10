// Quick-reference rules — core combat actions, cover, and exhaustion levels —
// curated for the Compendium's "Rules" tab.

export interface RuleDef {
  id: string;
  name: string;
  category: "action" | "cover" | "exhaustion";
  description: string;
}

export const RULES_REFERENCE: RuleDef[] = [
  // Core actions
  { id: "action-attack", name: "Attack", category: "action", description: "Make one melee or ranged attack, or more if a feature grants extra attacks." },
  { id: "action-cast-a-spell", name: "Cast a Spell", category: "action", description: "Cast a spell with a casting time of 1 action." },
  { id: "action-dash", name: "Dash", category: "action", description: "Gain extra movement equal to your speed for the current turn." },
  { id: "action-disengage", name: "Disengage", category: "action", description: "Your movement doesn't provoke opportunity attacks for the rest of the turn." },
  { id: "action-dodge", name: "Dodge", category: "action", description: "Until your next turn, any attack roll against you has disadvantage if you can see the attacker, and you have advantage on Dexterity saves." },
  { id: "action-help", name: "Help", category: "action", description: "Aid another creature in a task, giving it advantage on its next ability check for that task, or aid an attack against a creature within 5 feet, giving advantage on the next attack roll against it before your next turn." },
  { id: "action-hide", name: "Hide", category: "action", description: "Make a Dexterity (Stealth) check to try to hide, provided you're heavily obscured or have three-quarters/total cover." },
  { id: "action-ready", name: "Ready", category: "action", description: "Choose a trigger and an action or movement to take in response; you use your reaction to take it when the trigger occurs." },
  { id: "action-search", name: "Search", category: "action", description: "Devote your attention to finding something, usually a Wisdom (Perception) or Intelligence (Investigation) check." },
  { id: "action-use-an-object", name: "Use an Object", category: "action", description: "Interact with a second object, or use an object that requires an action to activate." },
  { id: "action-grapple", name: "Grapple", category: "action", description: "As part of the Attack action, replace one attack with a Strength (Athletics) check contested by the target's Athletics or Acrobatics, to grapple it." },
  { id: "action-shove", name: "Shove", category: "action", description: "As part of the Attack action, replace one attack with a Strength (Athletics) check contested the same way, to knock a creature prone or push it 5 feet." },
  { id: "action-opportunity-attack", name: "Opportunity Attack", category: "action", description: "When a hostile creature you can see moves out of your reach, use your reaction to make one melee attack against it." },
  // Cover
  { id: "cover-half", name: "Half Cover", category: "cover", description: "+2 bonus to AC and Dexterity saves. A target has half cover if an obstacle blocks at least half its body — a low wall, furniture, a creature." },
  { id: "cover-three-quarters", name: "Three-Quarters Cover", category: "cover", description: "+5 bonus to AC and Dexterity saves. A target has three-quarters cover if about three-quarters of it is blocked — an arrow slit, a thick tree trunk." },
  { id: "cover-total", name: "Total Cover", category: "cover", description: "Can't be targeted directly by an attack or spell. A target has total cover if it's completely concealed by an obstacle." },
  // Exhaustion (levels are cumulative)
  { id: "exhaustion-1", name: "Exhaustion Level 1", category: "exhaustion", description: "Disadvantage on ability checks." },
  { id: "exhaustion-2", name: "Exhaustion Level 2", category: "exhaustion", description: "Speed halved (in addition to level 1's effect)." },
  { id: "exhaustion-3", name: "Exhaustion Level 3", category: "exhaustion", description: "Disadvantage on attack rolls and saving throws (in addition to prior levels' effects)." },
  { id: "exhaustion-4", name: "Exhaustion Level 4", category: "exhaustion", description: "Hit point maximum halved (in addition to prior levels' effects)." },
  { id: "exhaustion-5", name: "Exhaustion Level 5", category: "exhaustion", description: "Speed reduced to 0 (in addition to prior levels' effects)." },
  { id: "exhaustion-6", name: "Exhaustion Level 6", category: "exhaustion", description: "Death. A long rest reduces total exhaustion by 1 level, provided the creature has food and drink." },
];
