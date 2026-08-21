import type { BattleMap } from "@spark/shared";

export function BattleMapCardView({ battleMap }: { battleMap: BattleMap }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{battleMap.name}</h2>
      <p className="statblock-subtitle">{battleMap.width}×{battleMap.height} · {battleMap.tiles.length} tile{battleMap.tiles.length === 1 ? "" : "s"} painted</p>
      <hr className="rule gold" />

      {battleMap.notes && <p>{battleMap.notes}</p>}
      {battleMap.tags.length > 0 && (
        <p className="entity-meta">{battleMap.tags.join(", ")}</p>
      )}
    </div>
  );
}
