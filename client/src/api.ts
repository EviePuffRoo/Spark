import type {
  Character, GenerateRequest, GeneratedCharacter, World,
  Item, GenerateItemRequest, GeneratedItem,
  Location, GenerateLocationRequest, GeneratedLocation,
  QuestHook, GenerateQuestHookRequest, GeneratedQuestHook,
} from "@spark/shared";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
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
}

export interface WorldSummary extends World {
  characterCount: number;
  itemCount: number;
  locationCount: number;
  questCount: number;
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

  listWorlds: () => request<WorldSummary[]>("/worlds"),
  getWorld: (id: string) => request<World>(`/worlds/${id}`),
  createWorld: (name: string, description?: string) =>
    request<World>("/worlds", { method: "POST", body: JSON.stringify({ name, description }) }),
  updateWorld: (id: string, patch: Partial<World>) =>
    request<World>(`/worlds/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteWorld: (id: string) => request<void>(`/worlds/${id}`, { method: "DELETE" }),
};
