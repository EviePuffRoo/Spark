// Shared numeric caps for the things the paid tier raises. No feature is
// ever hard-gated behind payment — paid only raises these limits. Lives in
// shared (not server-only) so the client's Billing page can show the real
// numbers instead of vague "higher limits" copy.
export const FREE_TIER_WORLD_LIMIT = 3;
export const FREE_TIER_GENERATE_LIMIT = 60;
export const PAID_TIER_GENERATE_LIMIT = 240;
export const FREE_TIER_BATTLEMAP_LIMIT = 3;

// The roll log and party chat live views (rollLog.ts, chat.ts, worldLive.ts)
// all cap at this many most-recent rows for every account — this constant
// names that existing window so the paid-only "older history" endpoints and
// the Billing page's copy can't silently drift from what the live views
// actually show.
export const RECENT_HISTORY_LIMIT = 100;
