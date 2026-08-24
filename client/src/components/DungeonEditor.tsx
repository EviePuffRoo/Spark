import { useEffect, useState } from "react";
import type { DungeonInput, DungeonRoom, SearchResult, EncounterZone } from "@spark/shared";
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";

export function DungeonEditor({
  value, onSave, onCancel, saveLabel = "Save",
}: {
  value: DungeonInput;
  onSave: (input: DungeonInput) => void | Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const [name, setName] = useState(value.name);
  const [rooms, setRooms] = useState<DungeonRoom[]>(value.rooms);
  const [addingRoom, setAddingRoom] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(value.rooms[0]?.id ?? null);
  const [roomZones, setRoomZones] = useState<Record<string, EncounterZone[]>>({});
  const [battleMapNames, setBattleMapNames] = useState<Record<string, string>>({});
  const [pickingBattleMap, setPickingBattleMap] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  useEffect(() => {
    if (!selectedRoom || roomZones[selectedRoom.templateId]) return;
    api.getZoneMapTemplate(selectedRoom.templateId)
      .then((t) => setRoomZones((z) => ({ ...z, [selectedRoom.templateId]: t.zones })))
      .catch(() => {});
  }, [selectedRoom, roomZones]);

  useEffect(() => {
    const id = selectedRoom?.battleMapId;
    if (!id || battleMapNames[id]) return;
    api.getBattleMap(id).then((m) => setBattleMapNames((n) => ({ ...n, [id]: m.name }))).catch(() => {});
  }, [selectedRoom, battleMapNames]);

  useEffect(() => {
    setPickingBattleMap(false);
  }, [selectedRoomId]);

  function handlePickBattleMap(result: SearchResult) {
    if (!selectedRoom) return;
    setPickingBattleMap(false);
    updateRoom(selectedRoom.id, { battleMapId: result.id });
    setBattleMapNames((n) => ({ ...n, [result.id]: result.name }));
  }

  async function handleAddRoom(result: SearchResult) {
    setAddingRoom(false);
    const template = await api.getZoneMapTemplate(result.id);
    const newRoom: DungeonRoom = { id: crypto.randomUUID(), name: template.name, templateId: template.id, exits: [] };
    setRooms((r) => [...r, newRoom]);
    setRoomZones((z) => ({ ...z, [template.id]: template.zones }));
    setSelectedRoomId(newRoom.id);
  }

  function updateRoom(id: string, patch: Partial<DungeonRoom>) {
    setRooms((r) => r.map((room) => (room.id === id ? { ...room, ...patch } : room)));
  }

  function removeRoom(id: string) {
    setRooms((r) =>
      r.filter((room) => room.id !== id).map((room) => ({ ...room, exits: room.exits.filter((e) => e.toRoomId !== id) })),
    );
    setSelectedRoomId((current) => (current === id ? null : current));
  }

  function moveRoom(id: string, dir: -1 | 1) {
    setRooms((r) => {
      const index = r.findIndex((room) => room.id === id);
      const targetIndex = index + dir;
      if (index < 0 || targetIndex < 0 || targetIndex >= r.length) return r;
      const next = [...r];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function setExit(roomId: string, zoneId: string, toRoomId: string) {
    setRooms((r) =>
      r.map((room) => {
        if (room.id !== roomId) return room;
        const exits = room.exits.filter((e) => e.zoneId !== zoneId);
        if (toRoomId) exits.push({ zoneId, toRoomId });
        return { ...room, exits };
      }),
    );
  }

  async function handleSave() {
    if (!name.trim() || rooms.length === 0) return;
    setStatus("saving");
    try {
      await onSave({ name: name.trim(), rooms });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="dungeon-editor">
      <label className="field">
        <span>Dungeon name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Sunken Crypt" />
      </label>

      <h3 className="section-heading">Rooms</h3>
      {rooms.length === 0 && <p className="hint">Add a room from an existing Zone Map Template to get started.</p>}
      <ul className="entity-list">
        {rooms.map((room, index) => (
          <li key={room.id}>
            <button
              className={`entity-item ${room.id === selectedRoomId ? "active" : ""}`}
              aria-current={room.id === selectedRoomId ? "true" : undefined}
              onClick={() => setSelectedRoomId(room.id)}
            >
              <span className="entity-name">{room.name}</span>
              <span className="entity-meta">{room.exits.length} exit{room.exits.length === 1 ? "" : "s"}</span>
            </button>
            <div className="button-row">
              <button className="btn-secondary" disabled={index === 0} onClick={() => moveRoom(room.id, -1)} aria-label={`Move ${room.name} up`}>↑</button>
              <button className="btn-secondary" disabled={index === rooms.length - 1} onClick={() => moveRoom(room.id, 1)} aria-label={`Move ${room.name} down`}>↓</button>
              <button className="btn-danger" onClick={() => removeRoom(room.id)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>

      {addingRoom ? (
        <div className="save-panel">
          <EntitySearchPicker type="zoneMapTemplate" onSelect={handleAddRoom} placeholder="Search zone map templates…" />
          <button className="btn-secondary" onClick={() => setAddingRoom(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setAddingRoom(true)}>+ Add Room</button>
      )}

      {selectedRoom && (
        <div className="save-panel">
          <h4 className="section-heading">Room: {selectedRoom.name}</h4>
          <label className="field">
            <span>Room name</span>
            <input type="text" value={selectedRoom.name} onChange={(e) => updateRoom(selectedRoom.id, { name: e.target.value })} />
          </label>

          <h4 className="section-heading">Exits</h4>
          {!roomZones[selectedRoom.templateId] && <p className="hint">Loading zones…</p>}
          {(roomZones[selectedRoom.templateId] ?? []).length === 0 && roomZones[selectedRoom.templateId] && (
            <p className="hint">This template has no zones to link exits from.</p>
          )}
          {(roomZones[selectedRoom.templateId] ?? []).map((zone) => {
            const exit = selectedRoom.exits.find((e) => e.zoneId === zone.id);
            return (
              <label key={zone.id} className="field">
                <span>{zone.name} leads to</span>
                <select value={exit?.toRoomId ?? ""} onChange={(e) => setExit(selectedRoom.id, zone.id, e.target.value)}>
                  <option value="">No exit</option>
                  {rooms.filter((r) => r.id !== selectedRoom.id).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
            );
          })}

          <h4 className="section-heading">Battle Grid</h4>
          <p className="hint">Auto-loads on the grid map the moment the party enters this room during a live encounter.</p>
          {selectedRoom.battleMapId ? (
            <div className="button-row">
              <span className="entity-name">{battleMapNames[selectedRoom.battleMapId] ?? "Loading…"}</span>
              <button className="btn-secondary" onClick={() => updateRoom(selectedRoom.id, { battleMapId: undefined })}>Clear</button>
            </div>
          ) : pickingBattleMap ? (
            <div className="save-panel">
              <EntitySearchPicker type="battleMap" onSelect={handlePickBattleMap} placeholder="Search battle maps…" />
              <button className="btn-secondary" onClick={() => setPickingBattleMap(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn-secondary" onClick={() => setPickingBattleMap(true)}>+ Assign Battle Map</button>
          )}
        </div>
      )}

      <div className="button-row">
        <button className="btn-primary" onClick={handleSave} disabled={status === "saving" || !name.trim() || rooms.length === 0}>
          {status === "saving" ? "Saving…" : saveLabel}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
