import type {
  Character, GenerateRequest, GeneratedCharacter, World,
  Item, GenerateItemRequest, GeneratedItem,
  Location, GenerateLocationRequest, GeneratedLocation,
  QuestHook, GenerateQuestHookRequest, GeneratedQuestHook,
  Faction, GenerateFactionRequest, GeneratedFaction,
  EncounterTable, GenerateEncounterTableRequest, GeneratedEncounterTable,
  SessionNote, SessionNoteInput,
  Adventure, GenerateAdventureRequest, GeneratedAdventure,
  PlayerCharacter, PlayerCharacterInput,
  RollLogEntry, RollLogEntryInput,
  LedgerEntry, LedgerEntryInput, LedgerSummary,
  Encounter, EncounterStateInput,
  ActivitySummary,
  EntityType, EntityLink, SearchResult,
  AuthUser, SignupResult, RecoveryCodeResult,
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
    throw new Error(body.error ?? `Request failed: ${res.status}`);
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
  saveCharacter: (character: GeneratedCharacter & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<Character>("/characters", { method: "POST", body: JSON.stringify(character) }),
  updateCharacter: (id: string, patch: Partial<Character>) =>
    request<Character>(`/characters/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCharacter: (id: string) => request<void>(`/characters/${id}`, { method: "DELETE" }),

  listItems: (worldId?: string) =>
    request<Item[]>(`/items${worldId ? `?worldId=${worldId}` : ""}`),
  getItem: (id: string) => request<Item>(`/items/${id}`),
  saveItem: (item: GeneratedItem & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<Item>("/items", { method: "POST", body: JSON.stringify(item) }),
  updateItem: (id: string, patch: Partial<Item>) =>
    request<Item>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteItem: (id: string) => request<void>(`/items/${id}`, { method: "DELETE" }),

  listLocations: (worldId?: string) =>
    request<Location[]>(`/locations${worldId ? `?worldId=${worldId}` : ""}`),
  getLocation: (id: string) => request<Location>(`/locations/${id}`),
  saveLocation: (location: GeneratedLocation & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<Location>("/locations", { method: "POST", body: JSON.stringify(location) }),
  updateLocation: (id: string, patch: Partial<Location>) =>
    request<Location>(`/locations/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteLocation: (id: string) => request<void>(`/locations/${id}`, { method: "DELETE" }),

  listQuests: (worldId?: string) =>
    request<QuestHook[]>(`/quests${worldId ? `?worldId=${worldId}` : ""}`),
  getQuest: (id: string) => request<QuestHook>(`/quests/${id}`),
  saveQuest: (quest: GeneratedQuestHook & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<QuestHook>("/quests", { method: "POST", body: JSON.stringify(quest) }),
  updateQuest: (id: string, patch: Partial<QuestHook>) =>
    request<QuestHook>(`/quests/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteQuest: (id: string) => request<void>(`/quests/${id}`, { method: "DELETE" }),

  listFactions: (worldId?: string) =>
    request<Faction[]>(`/factions${worldId ? `?worldId=${worldId}` : ""}`),
  getFaction: (id: string) => request<Faction>(`/factions/${id}`),
  saveFaction: (faction: GeneratedFaction & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<Faction>("/factions", { method: "POST", body: JSON.stringify(faction) }),
  updateFaction: (id: string, patch: Partial<Faction>) =>
    request<Faction>(`/factions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteFaction: (id: string) => request<void>(`/factions/${id}`, { method: "DELETE" }),

  listEncounterTables: (worldId?: string) =>
    request<EncounterTable[]>(`/encounter-tables${worldId ? `?worldId=${worldId}` : ""}`),
  getEncounterTable: (id: string) => request<EncounterTable>(`/encounter-tables/${id}`),
  saveEncounterTable: (table: GeneratedEncounterTable & { worldId?: string | null; tags?: string[]; notes?: string }) =>
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
  saveAdventure: (adventure: GeneratedAdventure & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<Adventure>("/adventures", { method: "POST", body: JSON.stringify(adventure) }),
  updateAdventure: (id: string, patch: Partial<Adventure>) =>
    request<Adventure>(`/adventures/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteAdventure: (id: string) => request<void>(`/adventures/${id}`, { method: "DELETE" }),

  listPlayerCharacters: (worldId?: string) =>
    request<PlayerCharacter[]>(`/player-characters${worldId ? `?worldId=${worldId}` : ""}`),
  listMyPlayerCharacters: () => request<PlayerCharacter[]>("/player-characters?mine=true"),
  getPlayerCharacter: (id: string) => request<PlayerCharacter>(`/player-characters/${id}`),
  savePlayerCharacter: (pc: PlayerCharacterInput & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<PlayerCharacter>("/player-characters", { method: "POST", body: JSON.stringify(pc) }),
  updatePlayerCharacter: (id: string, patch: Partial<PlayerCharacter>) =>
    request<PlayerCharacter>(`/player-characters/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deletePlayerCharacter: (id: string) => request<void>(`/player-characters/${id}`, { method: "DELETE" }),

  listRollLog: (worldId: string) => request<RollLogEntry[]>(`/roll-log?worldId=${worldId}`),
  postRollLogEntry: (entry: RollLogEntryInput) =>
    request<RollLogEntry>("/roll-log", { method: "POST", body: JSON.stringify(entry) }),
  deleteRollLogEntry: (id: string) => request<void>(`/roll-log/${id}`, { method: "DELETE" }),

  getLedger: (worldId: string) => request<LedgerSummary>(`/ledger?worldId=${worldId}`),
  postLedgerEntry: (entry: LedgerEntryInput) =>
    request<LedgerEntry>("/ledger", { method: "POST", body: JSON.stringify(entry) }),
  deleteLedgerEntry: (id: string) => request<void>(`/ledger/${id}`, { method: "DELETE" }),

  getEncounter: (worldId: string) => request<Encounter>(`/encounters/${worldId}`),
  saveEncounter: (worldId: string, state: EncounterStateInput) =>
    request<Encounter>(`/encounters/${worldId}`, { method: "PUT", body: JSON.stringify(state) }),
  adjustEncounterHp: (worldId: string, combatantId: string, delta: number) =>
    request<Encounter>(`/encounters/${worldId}/adjust-hp`, { method: "POST", body: JSON.stringify({ combatantId, delta }) }),

  getActivity: () => request<ActivitySummary>("/activity"),

  listWorlds: () => request<WorldSummary[]>("/worlds"),
  getWorld: (id: string) => request<World>(`/worlds/${id}`),
  createWorld: (name: string, description?: string) =>
    request<World>("/worlds", { method: "POST", body: JSON.stringify({ name, description }) }),
  updateWorld: (id: string, patch: Partial<World>) =>
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
  importBackup: (bundle: unknown) =>
    request<ImportResult>("/backup/import", { method: "POST", body: JSON.stringify(bundle) }),

  signup: (username: string, password: string) =>
    request<SignupResult>("/auth/signup", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<AuthUser>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  regenerateRecoveryCode: () => request<RecoveryCodeResult>("/auth/recovery-code", { method: "POST" }),
  resetPassword: (username: string, recoveryCode: string, newPassword: string) =>
    request<SignupResult>("/auth/reset-password", { method: "POST", body: JSON.stringify({ username, recoveryCode, newPassword }) }),
};
