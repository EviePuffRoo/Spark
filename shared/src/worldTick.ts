import { hashSeed } from "./weather.js";
import type { Faction, FactionRelationship, Character, Shop, WorldTickProposal, WorldTickProposalItem } from "./types.js";

interface EventTemplate {
  title: (a: string, b: string) => string;
  description: (a: string, b: string) => string;
}

// Hand-written flavor text, same "hand-built content pool" convention as
// the generators — never live-authored, just picked deterministically by
// hashSeed so the same relationship/day-range always proposes the same
// event rather than re-rolling on every refresh.
const WAR_EVENT_TEMPLATES: EventTemplate[] = [
  { title: (a, b) => `Skirmish on the ${a}-${b} border`, description: (a, b) => `Scouts report a clash between ${a} and ${b} patrols. Casualties were light, but the border is tense.` },
  { title: (a, b) => `${a} raids ${b} supply lines`, description: (a, b) => `${a} forces struck at a ${b} caravan under cover of night, making off with supplies before ${b} could respond.` },
  { title: (a, b) => `${b} fortifies against ${a}`, description: (a, b) => `Word spreads that ${b} is reinforcing its holdings, wary of further aggression from ${a}.` },
  { title: (a, b) => `Peace talks between ${a} and ${b} collapse`, description: (a, b) => `An attempted truce between ${a} and ${b} fell apart before terms could be reached. The war continues.` },
];

const ALLY_EVENT_TEMPLATES: EventTemplate[] = [
  { title: (a, b) => `${a} and ${b} formalize their alliance`, description: (a, b) => `Representatives of ${a} and ${b} were seen exchanging gifts and pledges, deepening their existing bond.` },
  { title: (a, b) => `Joint venture between ${a} and ${b}`, description: (a, b) => `${a} and ${b} have begun coordinating openly, pooling resources toward a shared goal.` },
  { title: (a, b) => `${b} aids ${a} in a time of need`, description: (a, b) => `${b} sent support to ${a} following a recent setback, a gesture not lost on either faction's rank and file.` },
];

export interface WorldTickInput {
  worldId: string;
  fromDay: number;
  toDay: number;
  factions: Pick<Faction, "id" | "name" | "hiddenFromParty">[];
  relationships: Pick<FactionRelationship, "id" | "factionAId" | "factionBId" | "stance">[];
  characters: Pick<Character, "id" | "name" | "factionId" | "hiddenFromParty">[];
  shops: Pick<Shop, "id" | "name" | "stock">[];
}

// Deterministic: the same inputs always produce the same proposal, so
// recomputing it (e.g. to redisplay after a partial apply) never surprises
// the DM with different numbers. Elapsed days scales magnitude, not
// whether something happens at all — a 1-day advance can still nudge a
// reputation by ±1, it just won't spawn a flavor event (see the >=3 day
// gate below).
export function computeWorldTickProposal(input: WorldTickInput): WorldTickProposal {
  const { worldId, fromDay, toDay } = input;
  const elapsedDays = Math.max(0, toDay - fromDay);
  const items: WorldTickProposalItem[] = [];
  if (elapsedDays === 0) return { worldId, fromDay, toDay, items };

  const factionById = new Map(input.factions.map((f) => [f.id, f]));
  const activeRelationships = input.relationships.filter((r) => r.stance === "war" || r.stance === "ally");

  for (const rel of activeRelationships) {
    const a = factionById.get(rel.factionAId);
    const b = factionById.get(rel.factionBId);
    if (!a || !b) continue;
    const sign = rel.stance === "war" ? -1 : 1;
    const magnitude = Math.min(10, Math.max(1, Math.round(elapsedDays / 3)));

    for (const [self, other] of [[a, b], [b, a]] as const) {
      const seed = hashSeed(`worldTick:rep:${worldId}:${self.id}:${fromDay}:${toDay}`);
      const jitter = seed % 3; // 0, 1, or 2
      const delta = sign * (magnitude + jitter);
      if (delta === 0) continue;
      items.push({
        id: `factionReputation:${self.id}:${fromDay}:${toDay}`,
        kind: "factionReputation",
        factionId: self.id,
        delta,
        reasonOrTitle: rel.stance === "war" ? `Ongoing war with ${other.name}` : `Alliance with ${other.name} deepens`,
        summary: `${self.name} reputation ${delta > 0 ? "+" : ""}${delta} (${rel.stance === "war" ? `war with ${other.name}` : `ally of ${other.name}`})`,
      });
    }

    if (elapsedDays >= 3) {
      const pool = rel.stance === "war" ? WAR_EVENT_TEMPLATES : ALLY_EVENT_TEMPLATES;
      const seed = hashSeed(`worldTick:event:${worldId}:${rel.id}:${fromDay}:${toDay}`);
      const template = pool[seed % pool.length];
      const title = template.title(a.name, b.name);
      items.push({
        id: `campaignEvent:${rel.id}:${fromDay}:${toDay}`,
        kind: "campaignEvent",
        factionId: a.id,
        reasonOrTitle: title,
        description: template.description(a.name, b.name),
        summary: title,
      });
    }
  }

  for (const c of input.characters) {
    if (!c.factionId || c.hiddenFromParty) continue;
    const faction = factionById.get(c.factionId);
    if (!faction) continue;
    const relevant = activeRelationships.filter((r) => r.factionAId === faction.id || r.factionBId === faction.id);
    if (relevant.length === 0) continue;
    const trend = relevant.reduce((sum, r) => sum + (r.stance === "war" ? -1 : 1), 0);
    if (trend === 0) continue;
    const magnitude = Math.min(5, Math.max(1, Math.round(elapsedDays / 5)));
    const delta = Math.sign(trend) * magnitude;
    items.push({
      id: `characterDisposition:${c.id}:${fromDay}:${toDay}`,
      kind: "characterDisposition",
      characterId: c.id,
      delta,
      reasonOrTitle: `Drifting with ${faction.name}'s standing`,
      summary: `${c.name} disposition ${delta > 0 ? "+" : ""}${delta} (follows ${faction.name})`,
    });
  }

  for (const shop of input.shops) {
    for (const entry of shop.stock) {
      const pickSeed = hashSeed(`worldTick:shopPick:${worldId}:${entry.id}:${fromDay}:${toDay}`);
      if (pickSeed % 5 !== 0) continue; // roughly one in five entries fluctuates per tick
      const pctSeed = hashSeed(`worldTick:shopPct:${worldId}:${entry.id}:${fromDay}:${toDay}`);
      const pct = 5 + (pctSeed % 16); // 5-20%
      const direction = pickSeed % 2 === 0 ? 1 : -1;
      const newPrice = Math.max(1, Math.round(entry.price * (1 + (direction * pct) / 100)));
      const delta = newPrice - entry.price;
      if (delta === 0) continue;
      items.push({
        id: `shopStock:${entry.id}:${fromDay}:${toDay}`,
        kind: "shopStock",
        shopId: shop.id,
        stockEntryId: entry.id,
        delta,
        summary: `${shop.name}: ${entry.itemName} ${entry.price}gp → ${newPrice}gp`,
      });
    }
  }

  return { worldId, fromDay, toDay, items };
}
