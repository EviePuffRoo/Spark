import { DOWNTIME_OUTCOMES } from "../data/downtimeOutcomes.js";
import { pick } from "./random.js";
import type { DowntimeOutcomeActivityType, DowntimeOutcomeDef } from "../types.js";

export function generateDowntimeOutcome(activityType: DowntimeOutcomeActivityType): DowntimeOutcomeDef {
  return pick(DOWNTIME_OUTCOMES[activityType]);
}
