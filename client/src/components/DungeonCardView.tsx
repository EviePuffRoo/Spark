import type { Dungeon } from "@spark/shared";

export function DungeonCardView({ dungeon }: { dungeon: Dungeon }) {
  const roomName = (id: string) => dungeon.rooms.find((r) => r.id === id)?.name ?? "Unknown room";

  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{dungeon.name}</h2>
      <p className="statblock-subtitle">{dungeon.rooms.length} room{dungeon.rooms.length === 1 ? "" : "s"}</p>
      <hr className="rule gold" />

      {dungeon.rooms.map((room) => (
        <div key={room.id}>
          <h3 className="section-heading">{room.name}</h3>
          {room.exits.length === 0 ? (
            <p className="hint">No exits.</p>
          ) : (
            room.exits.map((exit) => (
              // Not just exit.zoneId: a generated room with 2+ exits can have
              // every exit share the room's single zoneId (see
              // shared/src/generator/dungeons.ts's connect()), which made
              // this collide and React warn about duplicate keys.
              <p key={`${exit.zoneId}-${exit.toRoomId}`}>{room.name} → {exit.label || "exit"} → {roomName(exit.toRoomId)}</p>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
