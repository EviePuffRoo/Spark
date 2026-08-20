import { useEffect, useRef, useState } from "react";
import type { Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Adventure, PlayerCharacter, ZoneMapTemplate, Dungeon, DungeonRoomRect, Shop, Region, Settlement, EntityType, QuestStatus } from "@spark/shared";
import { QUEST_STATUSES, QUEST_STATUS_LABELS, layoutDungeonRooms } from "@spark/shared";
import { api, type WorldSummary, type WorldMemberInfo } from "../api";
import { useAuth } from "../AuthContext";
import { downloadJson } from "../downloadJson";
import { useScrollDetailOnSelect } from "../useScrollDetailOnSelect";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";
import { ItemCardView } from "../components/ItemCardView";
import { LocationCardView } from "../components/LocationCardView";
import { QuestHookCardView } from "../components/QuestHookCardView";
import { FactionCardView } from "../components/FactionCardView";
import { EncounterTableCardView } from "../components/EncounterTableCardView";
import { ZoneMapTemplateCardView } from "../components/ZoneMapTemplateCardView";
import { DungeonCardView } from "../components/DungeonCardView";
import { DungeonEditor } from "../components/DungeonEditor";
import { DungeonMapView } from "../components/DungeonMapView";
import { ShopCardView } from "../components/ShopCardView";
import { ShopEditor } from "../components/ShopEditor";
import { LinkedEntities } from "../components/LinkedEntities";
import { FactionWebView } from "../components/FactionWebView";
import { SessionNoteCardView } from "../components/SessionNoteCardView";
import { RosterIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { EquipmentPanel } from "../components/EquipmentPanel";
import { AdventureCardView } from "../components/AdventureCardView";
import { PlayerCharacterCardView } from "../components/PlayerCharacterCardView";
import type { PrintItem } from "../components/PrintPane";
import { CharacterEditor } from "../components/CharacterEditor";
import { ItemEditor } from "../components/ItemEditor";
import { LocationEditor } from "../components/LocationEditor";
import { QuestEditor } from "../components/QuestEditor";
import { FactionEditor } from "../components/FactionEditor";
import { EncounterTableEditor } from "../components/EncounterTableEditor";
import { AdventureEditor } from "../components/AdventureEditor";
import { PlayerCharacterEditor } from "../components/PlayerCharacterEditor";
import { RegionCardView } from "../components/RegionCardView";
import { RegionEditor } from "../components/RegionEditor";
import { SettlementCardView } from "../components/SettlementCardView";
import { SettlementEditor } from "../components/SettlementEditor";
import { EntitySearchPicker } from "../components/EntitySearchPicker";
import { GroupedTabs } from "../components/GroupedTabs";

export type Mode = "characters" | "items" | "locations" | "quests" | "factions" | "encounters" | "notes" | "adventures" | "playerCharacters" | "zoneMapTemplates" | "dungeons" | "shops" | "regions" | "settlements";
type RosterGroup = "characters" | "world" | "story" | "tools";

const MODE_LABELS: Record<Mode, string> = {
  characters: "Characters",
  items: "Items",
  locations: "Locations",
  quests: "Quests",
  factions: "Factions",
  encounters: "Encounters",
  notes: "Notes",
  adventures: "Adventures",
  playerCharacters: "Player Characters",
  zoneMapTemplates: "Zone Map Templates",
  dungeons: "Dungeons",
  shops: "Shops",
  regions: "Regions",
  settlements: "Settlements",
};

const ROSTER_GROUPS: Record<RosterGroup, Mode[]> = {
  characters: ["characters", "playerCharacters"],
  world: ["locations", "regions", "settlements"],
  story: ["quests", "factions", "adventures", "encounters", "notes"],
  tools: ["items", "shops", "dungeons", "zoneMapTemplates"],
};

const ROSTER_GROUP_LABELS: Record<RosterGroup, string> = {
  characters: "Characters",
  world: "World",
  story: "Story",
  tools: "Tools",
};

const ROSTER_MODE_TO_GROUP = Object.fromEntries(
  (Object.keys(ROSTER_GROUPS) as RosterGroup[]).flatMap((g) => ROSTER_GROUPS[g].map((m) => [m, g])),
) as Record<Mode, RosterGroup>;

export const ENTITY_TYPE_TO_MODE: Record<EntityType, Mode> = {
  character: "characters",
  item: "items",
  location: "locations",
  quest: "quests",
  faction: "factions",
  encounterTable: "encounters",
  sessionNote: "notes",
  adventure: "adventures",
  playerCharacter: "playerCharacters",
  zoneMapTemplate: "zoneMapTemplates",
  dungeon: "dungeons",
  shop: "shops",
  region: "regions",
  settlement: "settlements",
};

const MODE_TO_ENTITY_TYPE: Record<Mode, EntityType> = {
  characters: "character",
  items: "item",
  locations: "location",
  quests: "quest",
  factions: "faction",
  encounters: "encounterTable",
  notes: "sessionNote",
  adventures: "adventure",
  playerCharacters: "playerCharacter",
  zoneMapTemplates: "zoneMapTemplate",
  dungeons: "dungeon",
  shops: "shop",
  regions: "region",
  settlements: "settlement",
};

export interface RosterSelection {
  type: EntityType;
  id: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "actor";
}

async function fetchPrintItem(type: EntityType, id: string): Promise<PrintItem | null> {
  switch (type) {
    case "character": return { type, data: await api.getCharacter(id) };
    case "item": return { type, data: await api.getItem(id) };
    case "location": return { type, data: await api.getLocation(id) };
    case "quest": return { type, data: await api.getQuest(id) };
    case "faction": return { type, data: await api.getFaction(id) };
    case "encounterTable": return { type, data: await api.getEncounterTable(id) };
    case "sessionNote": return { type, data: await api.getSessionNote(id) };
    case "adventure": return { type, data: await api.getAdventure(id) };
    case "playerCharacter": return { type, data: await api.getPlayerCharacter(id) };
    default: return null;
  }
}

export function RosterPage({
  worldFilter, onWorldFilterChange, pendingSelection, onConsumeSelection, onPrint,
}: {
  worldFilter: string;
  onWorldFilterChange: (v: string) => void;
  pendingSelection?: RosterSelection | null;
  onConsumeSelection?: () => void;
  onPrint?: (items: PrintItem[]) => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("characters");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [quests, setQuests] = useState<QuestHook[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [encounters, setEncounters] = useState<EncounterTable[]>([]);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [playerCharacters, setPlayerCharacters] = useState<PlayerCharacter[]>([]);
  const [zoneMapTemplates, setZoneMapTemplates] = useState<ZoneMapTemplate[]>([]);
  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  useScrollDetailOnSelect(detailRef, selectedId);
  const [metaNotes, setMetaNotes] = useState("");
  const [tags, setTags] = useState("");
  const [assignedWorld, setAssignedWorld] = useState("");
  const [hiddenFromParty, setHiddenFromParty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuestStatus | "">("");
  const [searchFilter, setSearchFilter] = useState("");
  const [questStatus, setQuestStatus] = useState<QuestStatus>("active");
  const [showFactionWeb, setShowFactionWeb] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishStatus, setPublishStatus] = useState<"idle" | "saving" | "published">("idle");
  const [showDungeonMap, setShowDungeonMap] = useState(false);
  const [worldMembers, setWorldMembers] = useState<WorldMemberInfo[]>([]);
  const [assignTargetUserId, setAssignTargetUserId] = useState("");
  const [assignStatus, setAssignStatus] = useState<"idle" | "saving">("idle");
  const [assignError, setAssignError] = useState<string | null>(null);

  function refresh() {
    const w = worldFilter || undefined;
    setLoading(true);
    Promise.all([
      api.listCharacters(w).then(setCharacters).catch(() => {}),
      api.listItems(w).then(setItems).catch(() => {}),
      api.listLocations(w).then(setLocations).catch(() => {}),
      api.listQuests(w).then(setQuests).catch(() => {}),
      api.listFactions(w).then(setFactions).catch(() => {}),
      api.listEncounterTables(w).then(setEncounters).catch(() => {}),
      api.listSessionNotes(w).then(setNotes).catch(() => {}),
      api.listAdventures(w).then(setAdventures).catch(() => {}),
      api.listPlayerCharacters(w).then(setPlayerCharacters).catch(() => {}),
      api.listZoneMapTemplates(w).then(setZoneMapTemplates).catch(() => {}),
      api.listDungeons(w).then(setDungeons).catch(() => {}),
      api.listShops(w).then(setShops).catch(() => {}),
      api.listRegions(w).then(setRegions).catch(() => {}),
      api.listSettlements(w).then(setSettlements).catch(() => {}),
      api.listWorlds().then(setWorlds).catch(() => {}),
    ]).finally(() => setLoading(false));
  }

  useEffect(refresh, [worldFilter]);

  // If the world currently selected in the filter gets deleted elsewhere, the
  // dropdown falls back to displaying "All" (no matching <option> anymore),
  // but the filter itself would silently stay pointed at the dead world's id
  // unless we reset it - showing zero results instead of actually falling
  // back to "All".
  useEffect(() => {
    if (loading) return;
    if (!worldFilter || worldFilter === "unassigned") return;
    if (!worlds.some((w) => w.id === worldFilter)) {
      onWorldFilterChange("");
    }
  }, [loading, worlds, worldFilter, onWorldFilterChange]);

  useEffect(() => {
    if (!pendingSelection) return;
    setMode(ENTITY_TYPE_TO_MODE[pendingSelection.type]);
    if (worldFilter) onWorldFilterChange("");
    setSelectedId(pendingSelection.id);
    onConsumeSelection?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelection]);

  function switchMode(next: Mode) {
    setMode(next);
    setSelectedId(null);
    setTagFilter("");
    setStatusFilter("");
    setSearchFilter("");
    setShowFactionWeb(false);
  }

  const selectedCharacter = mode === "characters" ? characters.find((c) => c.id === selectedId) ?? null : null;
  const selectedItem = mode === "items" ? items.find((i) => i.id === selectedId) ?? null : null;
  const selectedLocation = mode === "locations" ? locations.find((l) => l.id === selectedId) ?? null : null;
  const selectedQuest = mode === "quests" ? quests.find((q) => q.id === selectedId) ?? null : null;
  const selectedFaction = mode === "factions" ? factions.find((f) => f.id === selectedId) ?? null : null;
  const selectedEncounter = mode === "encounters" ? encounters.find((e) => e.id === selectedId) ?? null : null;
  const selectedNote = mode === "notes" ? notes.find((n) => n.id === selectedId) ?? null : null;
  const selectedAdventure = mode === "adventures" ? adventures.find((a) => a.id === selectedId) ?? null : null;
  const selectedPlayerCharacter = mode === "playerCharacters" ? playerCharacters.find((p) => p.id === selectedId) ?? null : null;
  const selectedZoneMapTemplate = mode === "zoneMapTemplates" ? zoneMapTemplates.find((z) => z.id === selectedId) ?? null : null;
  const selectedDungeon = mode === "dungeons" ? dungeons.find((d) => d.id === selectedId) ?? null : null;
  const selectedShop = mode === "shops" ? shops.find((s) => s.id === selectedId) ?? null : null;
  const selectedRegion = mode === "regions" ? regions.find((r) => r.id === selectedId) ?? null : null;
  const selectedSettlement = mode === "settlements" ? settlements.find((s) => s.id === selectedId) ?? null : null;
  const selected = selectedCharacter ?? selectedItem ?? selectedLocation ?? selectedQuest ?? selectedFaction ?? selectedEncounter ?? selectedNote ?? selectedAdventure ?? selectedPlayerCharacter ?? selectedZoneMapTemplate ?? selectedDungeon ?? selectedShop ?? selectedRegion ?? selectedSettlement;
  const selectedDisplayName =
    selectedCharacter?.name ?? selectedItem?.name ?? selectedLocation?.name ?? selectedQuest?.title ??
    selectedFaction?.name ?? selectedEncounter?.name ?? selectedNote?.title ?? selectedAdventure?.title ?? selectedPlayerCharacter?.name ?? selectedZoneMapTemplate?.name ?? selectedDungeon?.name ?? selectedShop?.name ?? selectedRegion?.name ?? selectedSettlement?.name ?? "";
  const canEditSelected = !selected || selected.userId === user?.id;

  // Reassigning a player character's owner is a world-ownership action, not
  // an entity-ownership one (canEditSelected) — the whole point is letting
  // the DM hand off a PC they created to the player who'll actually use it,
  // which means it must stay available even after that hand-off leaves the
  // DM's own account no longer owning the PC.
  const selectedPlayerCharacterWorld = selectedPlayerCharacter?.worldId
    ? worlds.find((w) => w.id === selectedPlayerCharacter.worldId)
    : undefined;
  const canReassignSelectedPlayerCharacter = !!selectedPlayerCharacterWorld?.isOwner;

  useEffect(() => {
    setAssignError(null);
    if (!canReassignSelectedPlayerCharacter || !selectedPlayerCharacterWorld) {
      setWorldMembers([]);
      return;
    }
    api.getWorldMembers(selectedPlayerCharacterWorld.id).then(setWorldMembers).catch(() => setWorldMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerCharacterWorld?.id, canReassignSelectedPlayerCharacter]);

  useEffect(() => {
    setAssignTargetUserId(selectedPlayerCharacter?.userId ?? "");
  }, [selectedPlayerCharacter?.id, selectedPlayerCharacter?.userId]);

  async function handleReassignOwner() {
    if (!selectedPlayerCharacter || !assignTargetUserId || assignTargetUserId === selectedPlayerCharacter.userId) return;
    setAssignStatus("saving");
    setAssignError(null);
    try {
      await api.reassignPlayerCharacterOwner(selectedPlayerCharacter.id, assignTargetUserId);
      refresh();
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setAssignStatus("idle");
    }
  }

  const [locationSettlementId, setLocationSettlementId] = useState<string | null>(null);
  const [locationSettlementName, setLocationSettlementName] = useState<string>("");
  const [pickingSettlement, setPickingSettlement] = useState(false);

  useEffect(() => {
    if (selected) {
      setMetaNotes(selected.notes ?? "");
      setTags(selected.tags.join(", "));
      setAssignedWorld(selected.worldId ?? "");
      setHiddenFromParty(selected.hiddenFromParty);
    }
    if (selectedQuest) setQuestStatus(selectedQuest.status);
    if (selectedLocation) {
      setLocationSettlementId(selectedLocation.settlementId ?? null);
      if (selectedLocation.settlementId) {
        api.getSettlement(selectedLocation.settlementId).then((s) => setLocationSettlementName(s.name)).catch(() => setLocationSettlementName(""));
      } else {
        setLocationSettlementName("");
      }
    }
    setPickingSettlement(false);
    setEditingContent(false);
    setShowDungeonMap(false);
    setActionError(null);
    setPublishOpen(false);
    setPublishStatus("idle");
    // Keyed on id, not the object itself: `selected`/`selectedQuest`/
    // `selectedLocation` are recomputed (new reference) on every list
    // refresh, including the optimistic per-pointermove updates from
    // dragging a room on the Dungeon Map — this should only reset local
    // edit state when the user actually switches to a different entity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selectedQuest?.id, selectedLocation?.id]);

  async function updateDungeonRoomRect(roomId: string, rect: DungeonRoomRect) {
    if (!selectedDungeon) return;
    const updatedRooms = selectedDungeon.rooms.map((r) => (r.id === roomId ? { ...r, rect } : r));
    setDungeons((ds) => ds.map((d) => (d.id === selectedDungeon.id ? { ...d, rooms: updatedRooms } : d)));
    await api.updateDungeon(selectedDungeon.id, { rooms: updatedRooms });
  }

  async function autoArrangeDungeon() {
    if (!selectedDungeon) return;
    const laidOutRooms = layoutDungeonRooms(selectedDungeon.rooms);
    setDungeons((ds) => ds.map((d) => (d.id === selectedDungeon.id ? { ...d, rooms: laidOutRooms } : d)));
    await api.updateDungeon(selectedDungeon.id, { rooms: laidOutRooms });
  }

  async function handleUpdate() {
    if (!selected) return;
    setStatus("saving");
    setActionError(null);
    const patch = {
      notes: metaNotes, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), worldId: assignedWorld || null,
      hiddenFromParty,
      ...(mode === "quests" ? { status: questStatus } : {}),
      ...(mode === "locations" ? { settlementId: locationSettlementId } : {}),
    };
    try {
      if (mode === "characters") await api.updateCharacter(selected.id, patch);
      else if (mode === "items") await api.updateItem(selected.id, patch);
      else if (mode === "locations") await api.updateLocation(selected.id, patch);
      else if (mode === "quests") await api.updateQuest(selected.id, patch);
      else if (mode === "factions") await api.updateFaction(selected.id, patch);
      else if (mode === "encounters") await api.updateEncounterTable(selected.id, patch);
      else if (mode === "notes") await api.updateSessionNote(selected.id, patch);
      else if (mode === "adventures") await api.updateAdventure(selected.id, patch);
      else if (mode === "playerCharacters") await api.updatePlayerCharacter(selected.id, patch);
      else if (mode === "zoneMapTemplates") await api.updateZoneMapTemplate(selected.id, patch);
      else if (mode === "dungeons") await api.updateDungeon(selected.id, patch);
      else if (mode === "shops") await api.updateShop(selected.id, patch);
      else if (mode === "regions") await api.updateRegion(selected.id, patch);
      else await api.updateSettlement(selected.id, patch);
      refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  function openPublish() {
    setPublishTitle(selectedDisplayName);
    setPublishDescription("");
    setPublishStatus("idle");
    setPublishOpen(true);
  }

  async function handlePublish() {
    if (!selected || !publishTitle.trim()) return;
    setPublishStatus("saving");
    setActionError(null);
    try {
      await api.publishEntry({
        entityType: MODE_TO_ENTITY_TYPE[mode], entityId: selected.id,
        title: publishTitle.trim(), description: publishDescription.trim() || undefined,
      });
      setPublishStatus("published");
    } catch (e) {
      setActionError((e as Error).message);
      setPublishStatus("idle");
    }
  }

  async function handleDuplicate() {
    if (!selected) return;
    setStatus("saving");
    const worldId = selected.worldId ?? null;
    const tagsCopy = [...selected.tags];
    const notesCopy = selected.notes;
    let created: { id: string } | null = null;
    if (selectedCharacter) {
      created = await api.saveCharacter({
        kind: selectedCharacter.kind, name: `${selectedCharacter.name} (Copy)`, race: selectedCharacter.race,
        background: selectedCharacter.background, alignment: selectedCharacter.alignment,
        templateId: selectedCharacter.templateId, templateName: selectedCharacter.templateName,
        statBlock: selectedCharacter.statBlock, backstory: selectedCharacter.backstory,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedItem) {
      created = await api.saveItem({
        name: `${selectedItem.name} (Copy)`, itemType: selectedItem.itemType, category: selectedItem.category,
        rarity: selectedItem.rarity, rarityTier: selectedItem.rarityTier, description: selectedItem.description, property: selectedItem.property,
        history: selectedItem.history, bonusType: selectedItem.bonusType, bonusValue: selectedItem.bonusValue,
        requiresAttunement: selectedItem.requiresAttunement, charges: selectedItem.charges, rechargeRule: selectedItem.rechargeRule,
        value: selectedItem.value, worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedLocation) {
      created = await api.saveLocation({
        name: `${selectedLocation.name} (Copy)`, locationType: selectedLocation.locationType, category: selectedLocation.category,
        description: selectedLocation.description, notableFeature: selectedLocation.notableFeature,
        keeper: selectedLocation.keeper, rumor: selectedLocation.rumor, worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedQuest) {
      created = await api.saveQuest({
        title: `${selectedQuest.title} (Copy)`, questType: selectedQuest.questType, tier: selectedQuest.tier,
        hook: selectedQuest.hook, objective: selectedQuest.objective, complication: selectedQuest.complication,
        reward: selectedQuest.reward, worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedFaction) {
      created = await api.saveFaction({
        name: `${selectedFaction.name} (Copy)`, factionType: selectedFaction.factionType, agenda: selectedFaction.agenda,
        methods: selectedFaction.methods, publicFace: selectedFaction.publicFace, hook: selectedFaction.hook,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedEncounter) {
      created = await api.saveEncounterTable({
        name: `${selectedEncounter.name} (Copy)`, terrain: selectedEncounter.terrain, entries: selectedEncounter.entries,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedNote) {
      created = await api.saveSessionNote({
        title: `${selectedNote.title} (Copy)`, sessionLabel: selectedNote.sessionLabel, summary: selectedNote.summary,
        looseThreads: selectedNote.looseThreads, nextSteps: selectedNote.nextSteps, worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedAdventure) {
      created = await api.saveAdventure({
        title: `${selectedAdventure.title} (Copy)`, tier: selectedAdventure.tier, premise: selectedAdventure.premise,
        hook: selectedAdventure.hook, objective: selectedAdventure.objective, complication: selectedAdventure.complication,
        reward: selectedAdventure.reward, worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedPlayerCharacter) {
      created = await api.savePlayerCharacter({
        name: `${selectedPlayerCharacter.name} (Copy)`, className: selectedPlayerCharacter.className, level: selectedPlayerCharacter.level,
        race: selectedPlayerCharacter.race, armorClass: selectedPlayerCharacter.armorClass, maxHp: selectedPlayerCharacter.maxHp,
        abilityScores: selectedPlayerCharacter.abilityScores, playerName: selectedPlayerCharacter.playerName,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedZoneMapTemplate) {
      created = await api.saveZoneMapTemplate({
        name: `${selectedZoneMapTemplate.name} (Copy)`, zones: selectedZoneMapTemplate.zones,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedDungeon) {
      const idMap = new Map<string, string>(selectedDungeon.rooms.map((r) => [r.id, crypto.randomUUID()]));
      const rooms = selectedDungeon.rooms.map((r) => ({
        ...r,
        id: idMap.get(r.id)!,
        exits: r.exits.map((e) => ({ ...e, toRoomId: idMap.get(e.toRoomId) ?? e.toRoomId })),
      }));
      created = await api.saveDungeon({
        name: `${selectedDungeon.name} (Copy)`, rooms,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedShop) {
      created = await api.saveShop({
        name: `${selectedShop.name} (Copy)`, description: selectedShop.description,
        stock: selectedShop.stock.map((s) => ({ ...s, id: crypto.randomUUID() })),
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedRegion) {
      created = await api.saveRegion({
        name: `${selectedRegion.name} (Copy)`, terrainCategory: selectedRegion.terrainCategory,
        dangerLevel: selectedRegion.dangerLevel, description: selectedRegion.description,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedSettlement) {
      created = await api.saveSettlement({
        name: `${selectedSettlement.name} (Copy)`, settlementType: selectedSettlement.settlementType,
        population: selectedSettlement.population, government: selectedSettlement.government,
        description: selectedSettlement.description, regionId: selectedSettlement.regionId,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    }
    setStatus("idle");
    refresh();
    if (created) setSelectedId(created.id);
  }

  function handlePrint() {
    if (!onPrint) return;
    if (selectedCharacter) onPrint([{ type: "character", data: selectedCharacter }]);
    else if (selectedItem) onPrint([{ type: "item", data: selectedItem }]);
    else if (selectedLocation) onPrint([{ type: "location", data: selectedLocation }]);
    else if (selectedQuest) onPrint([{ type: "quest", data: selectedQuest }]);
    else if (selectedFaction) onPrint([{ type: "faction", data: selectedFaction }]);
    else if (selectedEncounter) onPrint([{ type: "encounterTable", data: selectedEncounter }]);
    else if (selectedNote) onPrint([{ type: "sessionNote", data: selectedNote }]);
    else if (selectedAdventure) onPrint([{ type: "adventure", data: selectedAdventure }]);
    else if (selectedPlayerCharacter) onPrint([{ type: "playerCharacter", data: selectedPlayerCharacter }]);
  }

  async function handleExportFoundry() {
    if (selectedCharacter) {
      const actor = await api.exportCharacterForFoundry(selectedCharacter.id);
      downloadJson(`${slugify(selectedCharacter.name)}-foundry.json`, actor);
    } else if (selectedPlayerCharacter) {
      const actor = await api.exportPlayerCharacterForFoundry(selectedPlayerCharacter.id);
      downloadJson(`${slugify(selectedPlayerCharacter.name)}-foundry.json`, actor);
    }
  }

  async function handlePrintPack(rootItem: PrintItem) {
    if (!onPrint) return;
    const links = await api.getLinks(rootItem.type, rootItem.data.id);
    const linkedItems = await Promise.all(links.map((l) => fetchPrintItem(l.other.type, l.other.id)));
    onPrint([rootItem, ...linkedItems.filter((i): i is PrintItem => i !== null)]);
  }

  function handlePrintSessionPack() {
    if (!selectedNote) return;
    return handlePrintPack({ type: "sessionNote", data: selectedNote });
  }

  function handlePrintAdventurePack() {
    if (!selectedAdventure) return;
    return handlePrintPack({ type: "adventure", data: selectedAdventure });
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete ${selectedDisplayName}? This cannot be undone.`)) return;
    setActionError(null);
    try {
      if (mode === "characters") await api.deleteCharacter(selected.id);
      else if (mode === "items") await api.deleteItem(selected.id);
      else if (mode === "locations") await api.deleteLocation(selected.id);
      else if (mode === "quests") await api.deleteQuest(selected.id);
      else if (mode === "factions") await api.deleteFaction(selected.id);
      else if (mode === "encounters") await api.deleteEncounterTable(selected.id);
      else if (mode === "notes") await api.deleteSessionNote(selected.id);
      else if (mode === "adventures") await api.deleteAdventure(selected.id);
      else if (mode === "playerCharacters") await api.deletePlayerCharacter(selected.id);
      else if (mode === "zoneMapTemplates") await api.deleteZoneMapTemplate(selected.id);
      else if (mode === "dungeons") await api.deleteDungeon(selected.id);
      else if (mode === "shops") await api.deleteShop(selected.id);
      else if (mode === "regions") await api.deleteRegion(selected.id);
      else await api.deleteSettlement(selected.id);
    } catch (e) {
      setActionError((e as Error).message);
      return;
    }
    setSelectedId(null);
    refresh();
  }

  const activeEntities: { tags: string[] }[] =
    mode === "characters" ? characters :
    mode === "items" ? items :
    mode === "locations" ? locations :
    mode === "quests" ? quests :
    mode === "factions" ? factions :
    mode === "encounters" ? encounters :
    mode === "notes" ? notes :
    mode === "adventures" ? adventures :
    mode === "playerCharacters" ? playerCharacters :
    mode === "zoneMapTemplates" ? zoneMapTemplates :
    mode === "dungeons" ? dungeons :
    mode === "shops" ? shops :
    mode === "regions" ? regions :
    settlements;

  const availableTags = Array.from(new Set(activeEntities.flatMap((e) => e.tags))).sort();

  useEffect(() => {
    if (loading) return;
    if (!tagFilter) return;
    if (!availableTags.includes(tagFilter)) setTagFilter("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, availableTags.join("|"), tagFilter]);

  const unfiltered = activeEntities.length > 0;

  const trimmedSearch = searchFilter.trim().toLowerCase();
  const activeList = (
    mode === "characters" ? characters.filter((c) => !tagFilter || c.tags.includes(tagFilter)).map((c) => ({ id: c.id, name: c.name, meta: `${c.kind === "npc" ? c.race : c.templateName} · CR ${c.statBlock.challengeRating}`, hidden: c.hiddenFromParty })) :
    mode === "items" ? items.filter((i) => !tagFilter || i.tags.includes(tagFilter)).map((i) => ({ id: i.id, name: i.name, meta: `${i.category} · ${i.rarity}`, hidden: i.hiddenFromParty })) :
    mode === "locations" ? locations.filter((l) => !tagFilter || l.tags.includes(tagFilter)).map((l) => ({ id: l.id, name: l.name, meta: `${l.category} · ${l.locationType}`, hidden: l.hiddenFromParty })) :
    mode === "quests" ? quests.filter((q) => (!tagFilter || q.tags.includes(tagFilter)) && (!statusFilter || q.status === statusFilter)).map((q) => ({ id: q.id, name: q.title, meta: `${q.questType} · ${q.tier} · ${QUEST_STATUS_LABELS[q.status]}`, hidden: q.hiddenFromParty })) :
    mode === "factions" ? factions.filter((f) => !tagFilter || f.tags.includes(tagFilter)).map((f) => ({ id: f.id, name: f.name, meta: f.factionType, hidden: f.hiddenFromParty })) :
    mode === "encounters" ? encounters.filter((e) => !tagFilter || e.tags.includes(tagFilter)).map((e) => ({ id: e.id, name: e.name, meta: `${e.terrain} · d${e.entries.length}`, hidden: e.hiddenFromParty })) :
    mode === "notes" ? notes.filter((n) => !tagFilter || n.tags.includes(tagFilter)).map((n) => ({ id: n.id, name: n.title, meta: n.sessionLabel || new Date(n.createdAt).toLocaleDateString(), hidden: n.hiddenFromParty })) :
    mode === "adventures" ? adventures.filter((a) => !tagFilter || a.tags.includes(tagFilter)).map((a) => ({ id: a.id, name: a.title, meta: a.tier, hidden: a.hiddenFromParty })) :
    mode === "playerCharacters" ? playerCharacters.filter((p) => !tagFilter || p.tags.includes(tagFilter)).map((p) => ({ id: p.id, name: p.name, meta: `Level ${p.level} ${p.race} ${p.className}`, hidden: p.hiddenFromParty })) :
    mode === "zoneMapTemplates" ? zoneMapTemplates.filter((z) => !tagFilter || z.tags.includes(tagFilter)).map((z) => ({ id: z.id, name: z.name, meta: `${z.zones.length} zones`, hidden: z.hiddenFromParty })) :
    mode === "dungeons" ? dungeons.filter((d) => !tagFilter || d.tags.includes(tagFilter)).map((d) => ({ id: d.id, name: d.name, meta: `${d.rooms.length} rooms`, hidden: d.hiddenFromParty })) :
    mode === "shops" ? shops.filter((s) => !tagFilter || s.tags.includes(tagFilter)).map((s) => ({ id: s.id, name: s.name, meta: `${s.stock.length} items in stock`, hidden: s.hiddenFromParty })) :
    mode === "regions" ? regions.filter((r) => !tagFilter || r.tags.includes(tagFilter)).map((r) => ({ id: r.id, name: r.name, meta: `${r.terrainCategory}${r.dangerLevel ? ` · ${r.dangerLevel}` : ""}`, hidden: r.hiddenFromParty })) :
    settlements.filter((s) => !tagFilter || s.tags.includes(tagFilter)).map((s) => ({ id: s.id, name: s.name, meta: s.settlementType, hidden: s.hiddenFromParty }))
  ).filter((entry) => !trimmedSearch || entry.name.toLowerCase().includes(trimmedSearch));

  if (showFactionWeb) {
    return (
      <div className="page">
        <FactionWebView
          factions={factions}
          onSelectEntity={(type, id) => {
            setShowFactionWeb(false);
            setMode(ENTITY_TYPE_TO_MODE[type]);
            setSelectedId(id);
          }}
          onClose={() => setShowFactionWeb(false)}
        />
      </div>
    );
  }

  return (
    <div className="page roster-layout">
      <div className="panel roster-list">
        <GroupedTabs
          className="roster-mode-tabs"
          groups={ROSTER_GROUPS}
          groupLabels={ROSTER_GROUP_LABELS}
          itemLabels={MODE_LABELS}
          groupOf={(m) => ROSTER_MODE_TO_GROUP[m]}
          active={mode}
          onSelect={switchMode}
        />

        {mode === "factions" && (
          <button className="btn-secondary" onClick={() => setShowFactionWeb(true)}>Relationship Web</button>
        )}

        <label className="field">
          <span>Search</span>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Search ${MODE_LABELS[mode].toLowerCase()}…`}
          />
        </label>

        <label className="field">
          <span>Filter by world</span>
          <select value={worldFilter} onChange={(e) => onWorldFilterChange(e.target.value)}>
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>

        {availableTags.length > 0 && (
          <label className="field">
            <span>Filter by tag</span>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">All tags</option>
              {availableTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}

        {mode === "quests" && (
          <label className="field">
            <span>Filter by status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QuestStatus | "")}>
              <option value="">All statuses</option>
              {QUEST_STATUSES.map((s) => <option key={s} value={s}>{QUEST_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
        )}

        {loading && <p className="hint">Loading…</p>}
        {!loading && activeList.length === 0 && (
          <p className="hint">
            {unfiltered ? "No matches for your filters." : `No saved ${MODE_LABELS[mode].toLowerCase()} yet.`}
          </p>
        )}
        <ul className="entity-list">
          {activeList.map((entry) => (
            <li key={entry.id}>
              <button
                className={`entity-item ${entry.id === selectedId ? "active" : ""}`}
                aria-current={entry.id === selectedId ? "true" : undefined}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className="entity-name">
                  {entry.name}
                  {entry.hidden && <span className="hidden-badge" title="Hidden from party">🔒</span>}
                </span>
                <span className="entity-meta">{entry.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel result-panel" ref={detailRef}>
        {!selected && (
          <EmptyState
            icon={<RosterIcon />}
            heading="No entry selected"
            hint="Select an entry from the list to view its details."
          />
        )}

        {selected && editingContent && <h2>Editing {selectedDisplayName}</h2>}

        {selectedCharacter && !editingContent && (
          <>
            <StatBlockView
              name={selectedCharacter.name}
              subtitle={`${selectedCharacter.statBlock.size} ${selectedCharacter.statBlock.creatureType}, ${selectedCharacter.statBlock.alignment}${selectedCharacter.race ? ` — ${selectedCharacter.race}` : ""}${selectedCharacter.background ? `, ${selectedCharacter.background}` : ""}`}
              statBlock={selectedCharacter.statBlock}
            />
            <BackstoryView backstory={selectedCharacter.backstory} />
            <EquipmentPanel
              equippedItems={selectedCharacter.equippedItems}
              attunedItems={selectedCharacter.attunedItems}
              baseArmorClass={selectedCharacter.statBlock.armorClass}
            />
          </>
        )}
        {selectedCharacter && editingContent && (
          <CharacterEditor
            character={selectedCharacter}
            onSave={async (patch) => { await api.updateCharacter(selectedCharacter.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedItem && !editingContent && <ItemCardView item={selectedItem} />}
        {selectedItem && editingContent && (
          <ItemEditor
            value={selectedItem}
            onSave={async (patch) => { await api.updateItem(selectedItem.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedLocation && !editingContent && <LocationCardView location={selectedLocation} />}
        {selectedLocation && editingContent && (
          <LocationEditor
            value={selectedLocation}
            onSave={async (patch) => { await api.updateLocation(selectedLocation.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedQuest && !editingContent && <QuestHookCardView quest={selectedQuest} />}
        {selectedQuest && editingContent && (
          <QuestEditor
            value={selectedQuest}
            onSave={async (patch) => { await api.updateQuest(selectedQuest.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedFaction && !editingContent && (
          <FactionCardView
            faction={selectedFaction}
            canEdit={canEditSelected}
            onAdjustReputation={async (delta) => {
              await api.updateFaction(selectedFaction.id, { reputation: selectedFaction.reputation + delta });
              refresh();
            }}
          />
        )}
        {selectedFaction && editingContent && (
          <FactionEditor
            value={selectedFaction}
            onSave={async (patch) => { await api.updateFaction(selectedFaction.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedEncounter && !editingContent && <EncounterTableCardView table={selectedEncounter} />}
        {selectedEncounter && editingContent && (
          <EncounterTableEditor
            value={selectedEncounter}
            onSave={async (patch) => { await api.updateEncounterTable(selectedEncounter.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedNote && (
          <>
            <SessionNoteCardView note={selectedNote} />
            <p className="hint">Edit this note from the Notes tab.</p>
          </>
        )}

        {selectedAdventure && !editingContent && <AdventureCardView adventure={selectedAdventure} />}
        {selectedAdventure && editingContent && (
          <AdventureEditor
            value={selectedAdventure}
            onSave={async (patch) => { await api.updateAdventure(selectedAdventure.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedPlayerCharacter && !editingContent && (
          <>
            <PlayerCharacterCardView pc={selectedPlayerCharacter} />
            <EquipmentPanel
              equippedItems={selectedPlayerCharacter.equippedItems}
              attunedItems={selectedPlayerCharacter.attunedItems}
              baseArmorClass={selectedPlayerCharacter.armorClass}
            />
          </>
        )}
        {selectedPlayerCharacter && editingContent && (
          <PlayerCharacterEditor
            value={selectedPlayerCharacter}
            equippedItems={selectedPlayerCharacter.equippedItems}
            attunedItems={selectedPlayerCharacter.attunedItems}
            currentHp={selectedPlayerCharacter.currentHp}
            deathSaves={selectedPlayerCharacter.deathSaves}
            spellSlots={selectedPlayerCharacter.spellSlots}
            preparedSpells={selectedPlayerCharacter.preparedSpells}
            classResources={selectedPlayerCharacter.classResources}
            onSave={async (patch) => { await api.updatePlayerCharacter(selectedPlayerCharacter.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedZoneMapTemplate && (
          <>
            <ZoneMapTemplateCardView template={selectedZoneMapTemplate} />
            <p className="hint">Edit this template by loading it into a Zone Map in Combat and saving over it.</p>
          </>
        )}

        {selectedDungeon && !editingContent && <DungeonCardView dungeon={selectedDungeon} />}
        {selectedDungeon && !editingContent && showDungeonMap && (
          <DungeonMapView
            dungeon={selectedDungeon}
            canEdit={canEditSelected}
            onUpdateRoomRect={updateDungeonRoomRect}
            onAutoArrange={canEditSelected ? autoArrangeDungeon : undefined}
          />
        )}
        {selectedDungeon && editingContent && (
          <DungeonEditor
            value={selectedDungeon}
            onSave={async (patch) => { await api.updateDungeon(selectedDungeon.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
            saveLabel="Save Changes"
          />
        )}

        {selectedShop && !editingContent && <ShopCardView shop={selectedShop} />}
        {selectedShop && editingContent && (
          <ShopEditor
            value={selectedShop}
            onSave={async (patch) => { await api.updateShop(selectedShop.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
            saveLabel="Save Changes"
          />
        )}

        {selectedRegion && !editingContent && <RegionCardView region={selectedRegion} />}
        {selectedRegion && editingContent && (
          <RegionEditor
            value={selectedRegion}
            onSave={async (patch) => { await api.updateRegion(selectedRegion.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
            saveLabel="Save Changes"
          />
        )}

        {selectedSettlement && !editingContent && <SettlementCardView settlement={selectedSettlement} />}
        {selectedSettlement && editingContent && (
          <SettlementEditor
            value={selectedSettlement}
            onSave={async (patch) => { await api.updateSettlement(selectedSettlement.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
            saveLabel="Save Changes"
          />
        )}

        {selected && !editingContent && mode !== "notes" && mode !== "zoneMapTemplates" && mode !== "dungeons" && mode !== "shops" && canEditSelected && (
          <button className="btn-secondary" onClick={() => setEditingContent(true)}>Edit Content</button>
        )}
        {selectedDungeon && !editingContent && (
          <button className="btn-secondary" aria-pressed={showDungeonMap} onClick={() => setShowDungeonMap((v) => !v)}>
            {showDungeonMap ? "Hide Dungeon Map" : "View Dungeon Map"}
          </button>
        )}
        {selectedDungeon && !editingContent && canEditSelected && (
          <button className="btn-secondary" onClick={() => setEditingContent(true)}>Edit Rooms & Exits</button>
        )}
        {selectedShop && !editingContent && canEditSelected && (
          <button className="btn-secondary" onClick={() => setEditingContent(true)}>Edit Stock</button>
        )}

        {selected && !editingContent && onPrint && mode !== "zoneMapTemplates" && mode !== "dungeons" && mode !== "shops" && mode !== "regions" && mode !== "settlements" && (
          <button className="btn-secondary" onClick={handlePrint}>Print</button>
        )}
        {(selectedCharacter || selectedPlayerCharacter) && !editingContent && (
          <button className="btn-secondary" onClick={handleExportFoundry}>Export for Foundry VTT</button>
        )}
        {selected && !editingContent && onPrint && mode === "notes" && (
          <button className="btn-secondary" onClick={handlePrintSessionPack}>Print Session Pack</button>
        )}
        {selected && !editingContent && onPrint && mode === "adventures" && (
          <button className="btn-secondary" onClick={handlePrintAdventurePack}>Print Adventure Pack</button>
        )}

        {selected && !editingContent && (
          <>
            <LinkedEntities type={MODE_TO_ENTITY_TYPE[mode]} id={selected.id} />

            {selectedPlayerCharacter && canReassignSelectedPlayerCharacter && user && (
              <div className="save-panel">
                <h3 className="section-heading">Owner</h3>
                <p className="hint">Who this character sheet belongs to — that account is the only one who can edit it, rest it, and track its spell slots.</p>
                <label className="field">
                  <span>Belongs to</span>
                  <select value={assignTargetUserId} onChange={(e) => setAssignTargetUserId(e.target.value)}>
                    <option value={user.id}>{user.displayName || user.username} (you, DM)</option>
                    {worldMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.username}</option>
                    ))}
                  </select>
                </label>
                {assignError && <p className="error">{assignError}</p>}
                <button
                  className="btn-secondary"
                  onClick={handleReassignOwner}
                  disabled={assignStatus === "saving" || assignTargetUserId === selectedPlayerCharacter.userId}
                >
                  {assignStatus === "saving" ? "Saving…" : "Assign"}
                </button>
              </div>
            )}

            {canEditSelected ? (
              <div className="save-panel">
                <h3 className="section-heading">Roster Details</h3>
                <label className="field">
                  <span>World</span>
                  <select value={assignedWorld} onChange={(e) => setAssignedWorld(e.target.value)}>
                    <option value="">Unassigned</option>
                    {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
                {mode === "quests" && (
                  <label className="field">
                    <span>Status</span>
                    <select value={questStatus} onChange={(e) => setQuestStatus(e.target.value as QuestStatus)}>
                      {QUEST_STATUSES.map((s) => <option key={s} value={s}>{QUEST_STATUS_LABELS[s]}</option>)}
                    </select>
                  </label>
                )}
                {mode === "locations" && (
                  <label className="field">
                    <span>Settlement (optional)</span>
                    {locationSettlementId ? (
                      <div className="role-slot-filled">
                        <span className="role-slot-value">{locationSettlementName || "…"}</span>
                        <button className="btn-secondary" onClick={() => { setLocationSettlementId(null); setLocationSettlementName(""); }}>Clear</button>
                      </div>
                    ) : pickingSettlement ? (
                      <EntitySearchPicker type="settlement" onSelect={(r) => { setLocationSettlementId(r.id); setLocationSettlementName(r.name); setPickingSettlement(false); }} placeholder="Search settlements…" />
                    ) : (
                      <button className="btn-secondary" onClick={() => setPickingSettlement(true)}>+ Anchor to a Settlement</button>
                    )}
                  </label>
                )}
                <label className="field">
                  <input type="checkbox" checked={hiddenFromParty} onChange={(e) => setHiddenFromParty(e.target.checked)} />
                  {" "}Hidden from party
                </label>
                <label className="field">
                  <span>Tags</span>
                  <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
                </label>
                <label className="field">
                  <span>Notes</span>
                  <textarea value={metaNotes} onChange={(e) => setMetaNotes(e.target.value)} rows={3} />
                </label>
                {actionError && <p className="error">{actionError}</p>}
                <div className="button-row">
                  <button className="btn-primary" onClick={handleUpdate} disabled={status === "saving"}>
                    {status === "saving" ? "Saving…" : "Save Changes"}
                  </button>
                  <button className="btn-secondary" onClick={handleDuplicate} disabled={status === "saving"}>Duplicate</button>
                  <button className="btn-secondary" onClick={openPublish}>Publish to Gallery</button>
                  <button className="btn-danger" onClick={handleDelete}>Delete</button>
                </div>
                {publishOpen && (
                  <div className="save-panel">
                    <h3 className="section-heading">Publish to Gallery</h3>
                    <p className="hint">Anyone signed in will be able to view and clone this into their own Roster.</p>
                    <label className="field">
                      <span>Title</span>
                      <input type="text" value={publishTitle} onChange={(e) => setPublishTitle(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Description (optional)</span>
                      <textarea value={publishDescription} onChange={(e) => setPublishDescription(e.target.value)} rows={2} />
                    </label>
                    <div className="button-row">
                      <button className="btn-primary" onClick={handlePublish} disabled={publishStatus === "saving" || !publishTitle.trim()}>
                        {publishStatus === "saving" ? "Publishing…" : "Publish"}
                      </button>
                      <button className="btn-secondary" onClick={() => setPublishOpen(false)}>Cancel</button>
                    </div>
                    {publishStatus === "published" && <p className="success">Published — visible in the Homebrew Gallery.</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="save-panel">
                <h3 className="section-heading">Roster Details</h3>
                <p className="hint">Shared by the world's owner — you can view this, but only they can edit or delete it.</p>
                {tags && <p><strong>Tags:</strong> {tags}</p>}
                {metaNotes && <p><strong>Notes:</strong> {metaNotes}</p>}
                {actionError && <p className="error">{actionError}</p>}
                <div className="button-row">
                  <button className="btn-secondary" onClick={handleDuplicate} disabled={status === "saving"}>Duplicate</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
