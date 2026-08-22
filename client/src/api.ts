import type {
  Character, GenerateRequest, GeneratedCharacter, World,
  Item, GenerateItemRequest, GeneratedItem,
  Location, GenerateLocationRequest, GeneratedLocation,
  QuestHook, GenerateQuestHookRequest, GeneratedQuestHook,
  Faction, GenerateFactionRequest, GeneratedFaction,
  EncounterTable, GenerateEncounterTableRequest, GeneratedEncounterTable,
  SessionNote, SessionNoteInput,
  Adventure, GenerateAdventureRequest, GeneratedAdventure,
  PlayerCharacter, PlayerCharacterInput, GeneratePlayerCharacterRequest, GeneratedPlayerCharacter,
  RollLogEntry, RollLogEntryInput,
  ChatMessage, ChatMessageInput,
  CodexNote, CodexNoteInput,
  LedgerEntry, LedgerEntryInput, LedgerSummary,
  SessionHighlights,
  WorldAchievements,
  BaseState,
  DowntimeActivity, DowntimeActivityInput,
  Encounter, EncounterStateInput,
  ZoneMapTemplate, ZoneMapTemplateInput,
  Dungeon, DungeonInput, GenerateDungeonRequest, GeneratedDungeonOutline,
  BattleMap, BattleMapInput,
  Shop, ShopInput, GenerateShopRequest, GeneratedShop,
  Region, GenerateRegionRequest, GeneratedRegion,
  Settlement, GenerateSettlementRequest, GeneratedSettlement,
  ActivitySummary,
  EntityType, EntityLink, SearchResult,
  PublicGalleryEntry, PublishEntryInput, GalleryReportReason, ModerationQueueEntry, AdminUserSummary, AdminStats,
  AuthUser, SignupResult, RecoveryCodeResult,
  SpellDef, ConditionDef, RuleDef,
} from "@spark/shared";

let onSessionExpired: (() => void) | null = null;

// Called once by AuthProvider so a 401 on any authenticated request (not the
// auth endpoints themselves, where a 401 is an expected outcome) can bounce
// the user back to the login screen instead of showing a raw error inline.
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) {
      onSessionExpired?.();
    }
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `Request failed: ${res.status}`), { code: body.code as string | undefined });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface ReferenceData {
  races: { id: string; name: string; size: string; speed: number; darkvision: boolean; traits: string[] }[];
  backgrounds: { id: string; name: string; skills: string[]; flavor: string }[];
  alignments: string[];
  npcTemplates: { id: string; name: string; challengeRating: string; typicalAlignment: string }[];
  monsterTemplates: { id: string; name: string; challengeRating: string; typicalAlignment: string }[];
  itemCategories: { id: string; name: string }[];
  itemRarities: string[];
  locationCategories: { id: string; name: string }[];
  questTypes: string[];
  questTiers: string[];
  factionTypes: string[];
  encounterTerrains: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  shopArchetypes: { id: string; name: string }[];
  terrainCategories: { id: string; name: string }[];
  settlementTypes: { id: string; name: string }[];
}

export interface CompendiumData {
  spells: SpellDef[];
  conditions: ConditionDef[];
  rules: RuleDef[];
}

export interface ImportResult {
  worldsImported: number;
  entitiesImported: number;
  linksImported: number;
}

export interface WorldSummary extends World {
  isOwner: boolean;
  ownerUsername?: string;
  characterCount: number;
  itemCount: number;
  locationCount: number;
  questCount: number;
  factionCount: number;
  encounterTableCount: number;
  sessionNoteCount: number;
  adventureCount: number;
  playerCharacterCount: number;
}

export interface WorldMemberInfo {
  userId: string;
  username: string;
}

export const api = {
  getReference: () => request<ReferenceData>("/reference"),
  getCompendium: () => request<CompendiumData>("/compendium"),
  generate: (body: GenerateRequest) =>
    request<GeneratedCharacter>("/generate", { method: "POST", body: JSON.stringify(body) }),
  generateItem: (body: GenerateItemRequest) =>
    request<GeneratedItem>("/generate-item", { method: "POST", body: JSON.stringify(body) }),
  generateLocation: (body: GenerateLocationRequest) =>
    request<GeneratedLocation>("/generate-location", { method: "POST", body: JSON.stringify(body) }),
  generateQuest: (body: GenerateQuestHookRequest) =>
    request<GeneratedQuestHook>("/generate-quest", { method: "POST", body: JSON.stringify(body) }),
  generateFaction: (body: GenerateFactionRequest) =>
    request<GeneratedFaction>("/generate-faction", { method: "POST", body: JSON.stringify(body) }),
  generateEncounterTable: (body: GenerateEncounterTableRequest) =>
    request<GeneratedEncounterTable>("/generate-encounter-table", { method: "POST", body: JSON.stringify(body) }),
  generateAdventure: (body: GenerateAdventureRequest) =>
    request<GeneratedAdventure>("/generate-adventure", { method: "POST", body: JSON.stringify(body) }),

  listCharacters: (worldId?: string) =>
    request<Character[]>(`/characters${worldId ? `?worldId=${worldId}` : ""}`),
  getCharacter: (id: string) => request<Character>(`/characters/${id}`),
  exportCharacterForFoundry: (id: string) => request<Record<string, unknown>>(`/characters/${id}/export/foundry`),
  saveCharacter: (character: GeneratedCharacter & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<Character>("/characters", { method: "POST", body: JSON.stringify(character) }),
  updateCharacter: (id: string, patch: Partial<Character>) =>
    request<Character>(`/characters/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCharacter: (id: string) => request<void>(`/characters/${id}`, { method: "DELETE" }),

  listItems: (worldId?: string) =>
    request<Item[]>(`/items${worldId ? `?worldId=${worldId}` : ""}`),
  getItem: (id: string) => request<Item>(`/items/${id}`),
  saveItem: (item: GeneratedItem & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<Item>("/items", { method: "POST", body: JSON.stringify(item) }),
  updateItem: (id: string, patch: Partial<Item>) =>
    request<Item>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteItem: (id: string) => request<void>(`/items/${id}`, { method: "DELETE" }),

  listLocations: (worldId?: string) =>
    request<Location[]>(`/locations${worldId ? `?worldId=${worldId}` : ""}`),
  getLocation: (id: string) => request<Location>(`/locations/${id}`),
  saveLocation: (location: GeneratedLocation & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<Location>("/locations", { method: "POST", body: JSON.stringify(location) }),
  updateLocation: (id: string, patch: Partial<Location>) =>
    request<Location>(`/locations/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteLocation: (id: string) => request<void>(`/locations/${id}`, { method: "DELETE" }),

  listQuests: (worldId?: string) =>
    request<QuestHook[]>(`/quests${worldId ? `?worldId=${worldId}` : ""}`),
  getQuest: (id: string) => request<QuestHook>(`/quests/${id}`),
  saveQuest: (quest: GeneratedQuestHook & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<QuestHook>("/quests", { method: "POST", body: JSON.stringify(quest) }),
  updateQuest: (id: string, patch: Partial<QuestHook>) =>
    request<QuestHook>(`/quests/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteQuest: (id: string) => request<void>(`/quests/${id}`, { method: "DELETE" }),

  listFactions: (worldId?: string) =>
    request<Faction[]>(`/factions${worldId ? `?worldId=${worldId}` : ""}`),
  getFaction: (id: string) => request<Faction>(`/factions/${id}`),
  saveFaction: (faction: GeneratedFaction & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<Faction>("/factions", { method: "POST", body: JSON.stringify(faction) }),
  updateFaction: (id: string, patch: Partial<Faction>) =>
    request<Faction>(`/factions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteFaction: (id: string) => request<void>(`/factions/${id}`, { method: "DELETE" }),

  listEncounterTables: (worldId?: string) =>
    request<EncounterTable[]>(`/encounter-tables${worldId ? `?worldId=${worldId}` : ""}`),
  getEncounterTable: (id: string) => request<EncounterTable>(`/encounter-tables/${id}`),
  saveEncounterTable: (table: GeneratedEncounterTable & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<EncounterTable>("/encounter-tables", { method: "POST", body: JSON.stringify(table) }),
  updateEncounterTable: (id: string, patch: Partial<EncounterTable>) =>
    request<EncounterTable>(`/encounter-tables/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteEncounterTable: (id: string) => request<void>(`/encounter-tables/${id}`, { method: "DELETE" }),

  listSessionNotes: (worldId?: string) =>
    request<SessionNote[]>(`/session-notes${worldId ? `?worldId=${worldId}` : ""}`),
  getSessionNote: (id: string) => request<SessionNote>(`/session-notes/${id}`),
  saveSessionNote: (note: SessionNoteInput & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<SessionNote>("/session-notes", { method: "POST", body: JSON.stringify(note) }),
  updateSessionNote: (id: string, patch: Partial<SessionNote>) =>
    request<SessionNote>(`/session-notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSessionNote: (id: string) => request<void>(`/session-notes/${id}`, { method: "DELETE" }),

  listAdventures: (worldId?: string) =>
    request<Adventure[]>(`/adventures${worldId ? `?worldId=${worldId}` : ""}`),
  getAdventure: (id: string) => request<Adventure>(`/adventures/${id}`),
  saveAdventure: (adventure: GeneratedAdventure & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<Adventure>("/adventures", { method: "POST", body: JSON.stringify(adventure) }),
  updateAdventure: (id: string, patch: Partial<Adventure>) =>
    request<Adventure>(`/adventures/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteAdventure: (id: string) => request<void>(`/adventures/${id}`, { method: "DELETE" }),

  generatePlayerCharacter: (body: GeneratePlayerCharacterRequest) =>
    request<GeneratedPlayerCharacter>("/generate-player-character", { method: "POST", body: JSON.stringify(body) }),
  restPlayerCharacter: (id: string, kind: "short" | "long") =>
    request<PlayerCharacter>(`/player-characters/${id}/rest`, { method: "POST", body: JSON.stringify({ kind }) }),
  levelUpPlayerCharacter: (id: string, toLevel?: number) =>
    request<PlayerCharacter>(`/player-characters/${id}/level-up`, { method: "POST", body: JSON.stringify(toLevel !== undefined ? { toLevel } : {}) }),
  listPlayerCharacters: (worldId?: string) =>
    request<PlayerCharacter[]>(`/player-characters${worldId ? `?worldId=${worldId}` : ""}`),
  listMyPlayerCharacters: () => request<PlayerCharacter[]>("/player-characters?mine=true"),
  getPlayerCharacter: (id: string) => request<PlayerCharacter>(`/player-characters/${id}`),
  exportPlayerCharacterForFoundry: (id: string) => request<Record<string, unknown>>(`/player-characters/${id}/export/foundry`),
  savePlayerCharacter: (pc: PlayerCharacterInput & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<PlayerCharacter>("/player-characters", { method: "POST", body: JSON.stringify(pc) }),
  updatePlayerCharacter: (id: string, patch: Partial<PlayerCharacter>) =>
    request<PlayerCharacter>(`/player-characters/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deletePlayerCharacter: (id: string) => request<void>(`/player-characters/${id}`, { method: "DELETE" }),
  reassignPlayerCharacterOwner: (id: string, userId: string) =>
    request<PlayerCharacter>(`/player-characters/${id}/owner`, { method: "PATCH", body: JSON.stringify({ userId }) }),

  listRollLog: (worldId: string) => request<RollLogEntry[]>(`/roll-log?worldId=${worldId}`),
  postRollLogEntry: (entry: RollLogEntryInput) =>
    request<RollLogEntry>("/roll-log", { method: "POST", body: JSON.stringify(entry) }),
  deleteRollLogEntry: (id: string) => request<void>(`/roll-log/${id}`, { method: "DELETE" }),
  loadOlderRollLog: (worldId: string, before: string) =>
    request<RollLogEntry[]>(`/roll-log/history?worldId=${worldId}&before=${before}`),

  listChat: (worldId: string) => request<ChatMessage[]>(`/chat?worldId=${worldId}`),
  postChatMessage: (input: ChatMessageInput) =>
    request<ChatMessage>("/chat", { method: "POST", body: JSON.stringify(input) }),
  deleteChatMessage: (id: string) => request<void>(`/chat/${id}`, { method: "DELETE" }),
  loadOlderChat: (worldId: string, before: string) =>
    request<ChatMessage[]>(`/chat/history?worldId=${worldId}&before=${before}`),

  getCodexNotes: (entityType: EntityType, entityId: string) =>
    request<CodexNote[]>(`/codex-notes?entityType=${entityType}&entityId=${entityId}`),
  postCodexNote: (note: CodexNoteInput) =>
    request<CodexNote>("/codex-notes", { method: "POST", body: JSON.stringify(note) }),
  deleteCodexNote: (id: string) => request<void>(`/codex-notes/${id}`, { method: "DELETE" }),

  getLedger: (worldId: string) => request<LedgerSummary>(`/ledger?worldId=${worldId}`),
  getSessionHighlights: (worldId: string, since: string) =>
    request<SessionHighlights>(`/session-highlights?worldId=${worldId}&since=${encodeURIComponent(since)}`),
  getAchievements: (worldId: string) => request<WorldAchievements>(`/achievements?worldId=${worldId}`),
  getBase: (worldId: string) => request<BaseState>(`/base?worldId=${worldId}`),
  purchaseBaseUpgrade: (worldId: string, upgradeId: string, factionId?: string, rivalFactionId?: string) =>
    request<BaseState>("/base/purchase", { method: "POST", body: JSON.stringify({ worldId, upgradeId, factionId, rivalFactionId }) }),
  postLedgerEntry: (entry: LedgerEntryInput) =>
    request<LedgerEntry>("/ledger", { method: "POST", body: JSON.stringify(entry) }),
  deleteLedgerEntry: (id: string) => request<void>(`/ledger/${id}`, { method: "DELETE" }),
  claimLedgerItem: (worldId: string, itemId: string, playerCharacterId: string) =>
    request<PlayerCharacter>("/ledger/claim", { method: "POST", body: JSON.stringify({ worldId, itemId, playerCharacterId }) }),

  listDowntimeActivities: (worldId: string) => request<DowntimeActivity[]>(`/downtime?worldId=${worldId}`),
  postDowntimeActivity: (entry: DowntimeActivityInput) =>
    request<DowntimeActivity>("/downtime", { method: "POST", body: JSON.stringify(entry) }),
  deleteDowntimeActivity: (id: string) => request<void>(`/downtime/${id}`, { method: "DELETE" }),

  getEncounter: (worldId: string) => request<Encounter>(`/encounters/${worldId}`),
  saveEncounter: (worldId: string, state: EncounterStateInput) =>
    request<Encounter>(`/encounters/${worldId}`, { method: "PUT", body: JSON.stringify(state) }),
  adjustEncounterHp: (worldId: string, combatantId: string, delta: number) =>
    request<Encounter>(`/encounters/${worldId}/adjust-hp`, { method: "POST", body: JSON.stringify({ combatantId, delta }) }),
  moveCombatantZone: (worldId: string, combatantId: string, zoneId: string) =>
    request<Encounter>(`/encounters/${worldId}/move-zone`, { method: "POST", body: JSON.stringify({ combatantId, zoneId }) }),
  moveCombatantGrid: (worldId: string, combatantId: string, gridX: number, gridY: number) =>
    request<Encounter>(`/encounters/${worldId}/move-grid`, { method: "POST", body: JSON.stringify({ combatantId, gridX, gridY }) }),
  broadcastTokenPosition: (worldId: string, combatantId: string, gridX: number, gridY: number) =>
    request<void>(`/encounters/${worldId}/broadcast-token-position`, { method: "POST", body: JSON.stringify({ combatantId, gridX, gridY }) }),

  listZoneMapTemplates: (worldId?: string) =>
    request<ZoneMapTemplate[]>(`/zone-map-templates${worldId ? `?worldId=${worldId}` : ""}`),
  getZoneMapTemplate: (id: string) => request<ZoneMapTemplate>(`/zone-map-templates/${id}`),
  saveZoneMapTemplate: (template: ZoneMapTemplateInput & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<ZoneMapTemplate>("/zone-map-templates", { method: "POST", body: JSON.stringify(template) }),
  updateZoneMapTemplate: (id: string, patch: Partial<ZoneMapTemplate>) =>
    request<ZoneMapTemplate>(`/zone-map-templates/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteZoneMapTemplate: (id: string) => request<void>(`/zone-map-templates/${id}`, { method: "DELETE" }),

  generateDungeon: (body: GenerateDungeonRequest) =>
    request<GeneratedDungeonOutline>("/generate-dungeon", { method: "POST", body: JSON.stringify(body) }),
  listDungeons: (worldId?: string) =>
    request<Dungeon[]>(`/dungeons${worldId ? `?worldId=${worldId}` : ""}`),
  getDungeon: (id: string) => request<Dungeon>(`/dungeons/${id}`),
  saveDungeon: (dungeon: DungeonInput & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<Dungeon>("/dungeons", { method: "POST", body: JSON.stringify(dungeon) }),
  updateDungeon: (id: string, patch: Partial<Dungeon>) =>
    request<Dungeon>(`/dungeons/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteDungeon: (id: string) => request<void>(`/dungeons/${id}`, { method: "DELETE" }),
  listBattleMaps: (worldId?: string) =>
    request<BattleMap[]>(`/battle-maps${worldId ? `?worldId=${worldId}` : ""}`),
  getBattleMap: (id: string) => request<BattleMap>(`/battle-maps/${id}`),
  saveBattleMap: (map: BattleMapInput & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<BattleMap>("/battle-maps", { method: "POST", body: JSON.stringify(map) }),
  updateBattleMap: (id: string, patch: Partial<BattleMap>) =>
    request<BattleMap>(`/battle-maps/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteBattleMap: (id: string) => request<void>(`/battle-maps/${id}`, { method: "DELETE" }),

  generateShop: (body: GenerateShopRequest) =>
    request<GeneratedShop>("/generate-shop", { method: "POST", body: JSON.stringify(body) }),
  listShops: (worldId?: string) =>
    request<Shop[]>(`/shops${worldId ? `?worldId=${worldId}` : ""}`),
  getShop: (id: string) => request<Shop>(`/shops/${id}`),
  saveShop: (shop: ShopInput & { worldId?: string | null; tags?: string[]; notes?: string; hiddenFromParty?: boolean }) =>
    request<Shop>("/shops", { method: "POST", body: JSON.stringify(shop) }),
  updateShop: (id: string, patch: Partial<Shop>) =>
    request<Shop>(`/shops/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteShop: (id: string) => request<void>(`/shops/${id}`, { method: "DELETE" }),

  generateRegion: (body: GenerateRegionRequest) =>
    request<GeneratedRegion>("/generate-region", { method: "POST", body: JSON.stringify(body) }),
  listRegions: (worldId?: string) =>
    request<Region[]>(`/regions${worldId ? `?worldId=${worldId}` : ""}`),
  getRegion: (id: string) => request<Region>(`/regions/${id}`),
  saveRegion: (region: GeneratedRegion & { worldId?: string | null; tags?: string[]; notes?: string; x?: number; y?: number; hiddenFromParty?: boolean }) =>
    request<Region>("/regions", { method: "POST", body: JSON.stringify(region) }),
  updateRegion: (id: string, patch: Partial<Region>) =>
    request<Region>(`/regions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteRegion: (id: string) => request<void>(`/regions/${id}`, { method: "DELETE" }),

  generateSettlement: (body: GenerateSettlementRequest) =>
    request<GeneratedSettlement>("/generate-settlement", { method: "POST", body: JSON.stringify(body) }),
  listSettlements: (worldId?: string) =>
    request<Settlement[]>(`/settlements${worldId ? `?worldId=${worldId}` : ""}`),
  getSettlement: (id: string) => request<Settlement>(`/settlements/${id}`),
  saveSettlement: (settlement: GeneratedSettlement & { worldId?: string | null; tags?: string[]; notes?: string; regionId?: string | null; hiddenFromParty?: boolean }) =>
    request<Settlement>("/settlements", { method: "POST", body: JSON.stringify(settlement) }),
  updateSettlement: (id: string, patch: Partial<Settlement>) =>
    request<Settlement>(`/settlements/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSettlement: (id: string) => request<void>(`/settlements/${id}`, { method: "DELETE" }),

  getActivity: () => request<ActivitySummary>("/activity"),

  listWorlds: () => request<WorldSummary[]>("/worlds"),
  getWorld: (id: string) => request<World>(`/worlds/${id}`),
  createWorld: (name: string, description?: string) =>
    request<World>("/worlds", { method: "POST", body: JSON.stringify({ name, description }) }),
  createStarterWorld: () => request<{ worldId: string }>("/worlds/starter", { method: "POST" }),
  updateWorld: (id: string, patch: Partial<Omit<World, "nextSessionAt">> & { nextSessionAt?: string | null }) =>
    request<World>(`/worlds/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteWorld: (id: string) => request<void>(`/worlds/${id}`, { method: "DELETE" }),

  generateWorldJoinCode: (worldId: string) =>
    request<{ code: string }>(`/worlds/${worldId}/join-code`, { method: "POST" }),
  joinWorld: (code: string) =>
    request<{ worldId: string; worldName: string }>("/worlds/join", { method: "POST", body: JSON.stringify({ code }) }),
  getWorldMembers: (worldId: string) => request<WorldMemberInfo[]>(`/worlds/${worldId}/members`),
  removeWorldMember: (worldId: string, userId: string) =>
    request<void>(`/worlds/${worldId}/members/${userId}`, { method: "DELETE" }),
  leaveWorld: (worldId: string) => request<void>(`/worlds/${worldId}/leave`, { method: "POST" }),

  search: (q: string, type?: EntityType) =>
    request<{ query: string; results: SearchResult[] }>(
      `/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}`
    ),

  getLinks: (type: EntityType, id: string) =>
    request<EntityLink[]>(`/links?type=${type}&id=${id}`),
  createLink: (fromType: EntityType, fromId: string, toType: EntityType, toId: string, label?: string) =>
    request<unknown>("/links", { method: "POST", body: JSON.stringify({ fromType, fromId, toType, toId, label }) }),
  deleteLink: (id: string) => request<void>(`/links/${id}`, { method: "DELETE" }),

  exportWorld: (worldId: string) => request<unknown>(`/backup/export?worldId=${worldId}`),
  exportAll: () => request<unknown>("/backup/export"),

  listPublicGallery: (params?: { entityType?: EntityType; cursor?: string }) => {
    const q = new URLSearchParams();
    if (params?.entityType) q.set("entityType", params.entityType);
    if (params?.cursor) q.set("cursor", params.cursor);
    const qs = q.toString();
    return request<{ entries: PublicGalleryEntry[]; nextCursor: string | null }>(`/public${qs ? `?${qs}` : ""}`);
  },
  getPublicGalleryEntry: (id: string) =>
    request<{
      id: string; entityType: EntityType; entityId: string; title: string; description?: string;
      publisherUsername: string; publishedAt: string; data: unknown;
    }>(`/public/${id}`),
  publishEntry: (body: PublishEntryInput) =>
    request<{ id: string }>("/public", { method: "POST", body: JSON.stringify(body) }),
  unpublishEntry: (id: string) => request<void>(`/public/${id}`, { method: "DELETE" }),
  cloneFromGallery: (id: string) => request<{ id: string }>(`/public/${id}/clone`, { method: "POST" }),
  reportGalleryEntry: (id: string, reason: GalleryReportReason, detail?: string) =>
    request<{ ok: true }>(`/public/${id}/report`, { method: "POST", body: JSON.stringify({ reason, detail }) }),

  listModerationQueue: (params?: { status?: string; cursor?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.cursor) q.set("cursor", params.cursor);
    const qs = q.toString();
    return request<{ entries: ModerationQueueEntry[]; nextCursor: string | null }>(`/admin/gallery/reports${qs ? `?${qs}` : ""}`);
  },
  removeGalleryEntry: (id: string, reason: string) =>
    request<void>(`/admin/gallery/entries/${id}/remove`, { method: "POST", body: JSON.stringify({ reason }) }),
  dismissReport: (id: string) => request<void>(`/admin/gallery/reports/${id}/dismiss`, { method: "POST" }),
  suspendPublishing: (userId: string) => request<void>(`/admin/gallery/users/${userId}/suspend-publishing`, { method: "POST" }),
  restorePublishing: (userId: string) => request<void>(`/admin/gallery/users/${userId}/restore-publishing`, { method: "POST" }),

  lookupUsers: (query: string) => request<{ users: AdminUserSummary[] }>(`/admin/users?q=${encodeURIComponent(query)}`),
  adminIssueRecoveryCode: (userId: string) =>
    request<{ recoveryCode: string }>(`/admin/users/${userId}/recovery-code`, { method: "POST" }),
  adminSetPassword: (userId: string, newPassword: string) =>
    request<void>(`/admin/users/${userId}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),
  adminStats: () => request<AdminStats>("/admin/stats"),
  runDatabaseBackup: () => request<{ key: string; pruned: number }>("/admin/db-backup/run", { method: "POST" }),
  importBackup: (bundle: unknown) =>
    request<ImportResult>("/backup/import", { method: "POST", body: JSON.stringify(bundle) }),

  signup: (username: string, password: string) =>
    request<SignupResult>("/auth/signup", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<AuthUser>("/auth/me"),
  updateDisplayName: (displayName: string) =>
    request<AuthUser>("/auth/me", { method: "PATCH", body: JSON.stringify({ displayName }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  deleteAccount: (password: string) =>
    request<void>("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }),
  regenerateRecoveryCode: () => request<RecoveryCodeResult>("/auth/recovery-code", { method: "POST" }),
  resetPassword: (username: string, recoveryCode: string, newPassword: string) =>
    request<SignupResult>("/auth/reset-password", { method: "POST", body: JSON.stringify({ username, recoveryCode, newPassword }) }),

  createCheckoutSession: () => request<{ url: string | null }>("/billing/checkout", { method: "POST" }),
  createPortalSession: () => request<{ url: string | null }>("/billing/portal", { method: "POST" }),
};
