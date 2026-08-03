import type { Character, GenerateRequest, GeneratedCharacter, World } from "@spark/shared";

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
}

export interface WorldSummary extends World {
  characterCount: number;
}

export const api = {
  getReference: () => request<ReferenceData>("/reference"),
  generate: (body: GenerateRequest) =>
    request<GeneratedCharacter>("/generate", { method: "POST", body: JSON.stringify(body) }),

  listCharacters: (worldId?: string) =>
    request<Character[]>(`/characters${worldId ? `?worldId=${worldId}` : ""}`),
  getCharacter: (id: string) => request<Character>(`/characters/${id}`),
  saveCharacter: (character: GeneratedCharacter & { worldId?: string | null; tags?: string[]; notes?: string }) =>
    request<Character>("/characters", { method: "POST", body: JSON.stringify(character) }),
  updateCharacter: (id: string, patch: Partial<Character>) =>
    request<Character>(`/characters/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCharacter: (id: string) => request<void>(`/characters/${id}`, { method: "DELETE" }),

  listWorlds: () => request<WorldSummary[]>("/worlds"),
  getWorld: (id: string) => request<World>(`/worlds/${id}`),
  createWorld: (name: string, description?: string) =>
    request<World>("/worlds", { method: "POST", body: JSON.stringify({ name, description }) }),
  updateWorld: (id: string, patch: Partial<World>) =>
    request<World>(`/worlds/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteWorld: (id: string) => request<void>(`/worlds/${id}`, { method: "DELETE" }),
};
