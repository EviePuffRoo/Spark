import { hashSeed } from "./weather.js";

interface EventTemplate {
  title: (winner: string, loser: string) => string;
  description: (winner: string, loser: string) => string;
}

// Same "hand-built content pool, picked deterministically by hashSeed"
// convention as World Tick's own flavor events — never live-generated.
const DECISIVE_VICTORY_TEMPLATES: EventTemplate[] = [
  { title: (w, l) => `${w} routs ${l} in open battle`, description: (w, l) => `${w}'s forces broke ${l}'s line outright. What remained of ${l}'s ranks scattered rather than regroup.` },
  { title: (w, l) => `${l} is crushed by ${w}`, description: (w, l) => `A lopsided fight left ${l} unable to hold their ground. ${w} claims the field with room to spare.` },
  { title: (w, l) => `${w} shatters ${l}'s forces`, description: (w, l) => `${l} committed everything and it wasn't enough. ${w} walks away from the engagement barely tested.` },
];

const NARROW_VICTORY_TEMPLATES: EventTemplate[] = [
  { title: (w, l) => `${w} narrowly outlasts ${l}`, description: (w, l) => `A brutal, close-fought engagement between ${w} and ${l} — the field belongs to ${w}, but at real cost to both sides.` },
  { title: (w, l) => `Costly victory for ${w} over ${l}`, description: (w, l) => `${w} carries the day against ${l}, though survivors on both sides say it could easily have gone the other way.` },
  { title: (w, l) => `${w} edges out ${l} after a hard fight`, description: (w, l) => `Neither side yielded easily. ${w} ultimately held the field, but ${l} inflicted real losses before breaking.` },
];

const STALEMATE_TEMPLATES: EventTemplate[] = [
  { title: (a, b) => `${a} and ${b} clash without resolution`, description: (a, b) => `Skirmishing between ${a} and ${b} continues, but neither has the strength on the ground to force a decision.` },
];

export interface BattleCombatantInput {
  id: string;
  name: string;
  // Fighting strength — the caller supplies this (in practice each
  // affiliated Character's statBlock.xp), so this module stays free of
  // any assumption about how power is actually derived from a stat block.
  power: number;
}

export interface FactionBattleSideInput {
  factionId: string;
  factionName: string;
  combatants: BattleCombatantInput[];
}

export interface FactionBattleInput {
  worldId: string;
  relationshipId: string;
  // The world's calendar day at resolution time — this, not a random
  // nonce, is what the seed is keyed on. Resolving the same relationship
  // twice on the same day always reproduces the same outcome (so
  // reviewing a proposal before applying it never shows different numbers
  // than what actually gets applied); advancing the day and resolving
  // again produces a new one, the same "same inputs, same day range" rule
  // World Tick already follows.
  day: number;
  sideA: FactionBattleSideInput;
  sideB: FactionBattleSideInput;
}

export interface FactionBattleCasualty {
  characterId: string;
  characterName: string;
  factionId: string;
  outcome: "deceased" | "fled";
}

export interface FactionBattleReputationDelta {
  factionId: string;
  delta: number;
}

export interface FactionBattleProposal {
  relationshipId: string;
  day: number;
  // Null only when neither side has any combatants to commit — a
  // stalemate, not a battle.
  winnerFactionId: string | null;
  title: string;
  narrative: string;
  reputationDeltas: FactionBattleReputationDelta[];
  casualties: FactionBattleCasualty[];
}

function totalPower(side: FactionBattleSideInput): number {
  return side.combatants.reduce((sum, c) => sum + Math.max(0, c.power), 0);
}

// Every casualty roll and the winner pick itself all derive from the same
// seed family (worldId + relationshipId + day + a role tag), so calling
// this twice with identical input always returns an identical proposal.
function seeded(worldId: string, relationshipId: string, day: number, tag: string): number {
  return hashSeed(`battle:${tag}:${worldId}:${relationshipId}:${day}`);
}

function pickCasualties(
  worldId: string, relationshipId: string, day: number,
  side: FactionBattleSideInput, fraction: number, allowFlee: boolean,
): FactionBattleCasualty[] {
  const casualties: FactionBattleCasualty[] = [];
  for (const combatant of side.combatants) {
    const roll = hashSeed(`battle:casualty:${worldId}:${relationshipId}:${day}:${combatant.id}`) % 100;
    if (roll >= Math.round(fraction * 100)) continue;
    const fleeRoll = hashSeed(`battle:fled:${worldId}:${relationshipId}:${day}:${combatant.id}`) % 100;
    casualties.push({
      characterId: combatant.id,
      characterName: combatant.name,
      factionId: side.factionId,
      outcome: allowFlee && fleeRoll < 20 ? "fled" : "deceased",
    });
  }
  return casualties;
}

export function resolveFactionBattle(input: FactionBattleInput): FactionBattleProposal {
  const { worldId, relationshipId, day, sideA, sideB } = input;
  const powerA = totalPower(sideA);
  const powerB = totalPower(sideB);

  if (powerA === 0 && powerB === 0) {
    const seed = seeded(worldId, relationshipId, day, "stalemate");
    const template = STALEMATE_TEMPLATES[seed % STALEMATE_TEMPLATES.length];
    const title = template.title(sideA.factionName, sideB.factionName);
    return {
      relationshipId, day, winnerFactionId: null, title,
      narrative: template.description(sideA.factionName, sideB.factionName),
      reputationDeltas: [], casualties: [],
    };
  }

  const total = powerA + powerB;
  const winnerRoll = seeded(worldId, relationshipId, day, "winner") % total;
  const winnerIsA = winnerRoll < powerA;
  const winner = winnerIsA ? sideA : sideB;
  const loser = winnerIsA ? sideB : sideA;

  // 0 (evenly matched) to ~1 (total mismatch) — scales both reputation
  // swing and how bloody the fight was for each side.
  const decisiveness = total > 0 ? Math.abs(powerA - powerB) / total : 0;
  const jitter = seeded(worldId, relationshipId, day, "jitter") % 3;
  const repSwing = Math.round(6 + decisiveness * 10) + jitter;

  const loserCasualtyFraction = 0.3 + decisiveness * 0.4;
  const winnerCasualtyFraction = Math.max(0, 0.15 - decisiveness * 0.15);
  const casualties = [
    ...pickCasualties(worldId, relationshipId, day, loser, loserCasualtyFraction, true),
    ...pickCasualties(worldId, relationshipId, day, winner, winnerCasualtyFraction, false),
  ];

  const pool = decisiveness >= 0.35 ? DECISIVE_VICTORY_TEMPLATES : NARROW_VICTORY_TEMPLATES;
  const templateSeed = seeded(worldId, relationshipId, day, "template");
  const template = pool[templateSeed % pool.length];
  const title = template.title(winner.factionName, loser.factionName);

  return {
    relationshipId, day, winnerFactionId: winner.factionId, title,
    narrative: template.description(winner.factionName, loser.factionName),
    reputationDeltas: [
      { factionId: winner.factionId, delta: repSwing },
      { factionId: loser.factionId, delta: -repSwing },
    ],
    casualties,
  };
}
