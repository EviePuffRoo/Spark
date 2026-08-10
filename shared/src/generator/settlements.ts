import {
  SETTLEMENT_TYPES, POPULATION_BANDS, GOVERNMENT_TYPES,
  SETTLEMENT_NAME_ADJECTIVES, SETTLEMENT_NAME_SUFFIXES, SETTLEMENT_DESCRIPTIONS, SETTLEMENT_FEATURES,
} from "../data/settlements.js";
import { pick } from "./random.js";
import type { GenerateSettlementRequest, GeneratedSettlement } from "../types.js";

export function generateSettlement(request: GenerateSettlementRequest = {}): GeneratedSettlement {
  const settlementType =
    !request.fullyRandom && request.settlementType
      ? SETTLEMENT_TYPES.find((t) => t.id === request.settlementType) ?? pick(SETTLEMENT_TYPES)
      : pick(SETTLEMENT_TYPES);

  const name = `${pick(SETTLEMENT_NAME_ADJECTIVES)}${pick(SETTLEMENT_NAME_SUFFIXES)}`;
  const description = pick(SETTLEMENT_DESCRIPTIONS).replace("{feature}", pick(SETTLEMENT_FEATURES));

  return {
    name,
    settlementType: settlementType.name,
    population: POPULATION_BANDS[settlementType.id],
    government: pick(GOVERNMENT_TYPES),
    description,
  };
}
