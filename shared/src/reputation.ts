export type ReputationTier = "hostile" | "unfriendly" | "neutral" | "friendly" | "allied";

export const REPUTATION_TIER_LABELS: Record<ReputationTier, string> = {
  hostile: "Hostile",
  unfriendly: "Unfriendly",
  neutral: "Neutral",
  friendly: "Friendly",
  allied: "Allied",
};

export function computeReputationTier(value: number): ReputationTier {
  if (value <= -50) return "hostile";
  if (value <= -10) return "unfriendly";
  if (value < 10) return "neutral";
  if (value < 50) return "friendly";
  return "allied";
}
