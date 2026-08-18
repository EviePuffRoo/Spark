// Shared numeric caps for the two things the paid tier raises. No feature
// is ever hard-gated behind payment — paid only raises these limits. Lives
// in shared (not server-only) so the client's Billing page can show the
// real numbers instead of vague "higher limits" copy.
export const FREE_TIER_WORLD_LIMIT = 3;
export const FREE_TIER_GENERATE_LIMIT = 60;
export const PAID_TIER_GENERATE_LIMIT = 240;
