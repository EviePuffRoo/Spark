import { useEffect, useMemo, useRef, useState } from "react";
import type { BattleMap, PlacedTile, TileCategory } from "@spark/shared";
import { BATTLE_TILES, BATTLE_TILE_BY_ID, BATTLE_MAP_MAX_WIDTH, BATTLE_MAP_MAX_HEIGHT } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { MapBuilderIcon } from "../components/icons";
import { BattleTileDefs, TileSwatch } from "../components/TileIcon";
import { EmptyState } from "../components/EmptyState";
import { SaveEntityFields } from "../components/SaveEntityFields";

const CELL = 32;

const CATEGORY_LABELS: Record<TileCategory, string> = {
  terrain: "Terrain",
  structure: "Structure",
  nature: "Nature",
  hazard: "Hazard",
  decor: "Decor",
  gmOnly: "GM Only",
};
const CATEGORIES = Object.keys(CATEGORY_LABELS) as TileCategory[];

function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

function layerForTile(tileId: string): "floor" | "decor" | "gmOnly" {
  const category = BATTLE_TILE_BY_ID[tileId]?.category;
  if (category === "decor") return "decor";
  if (category === "gmOnly") return "gmOnly";
  return "floor";
}

// A cell can hold at most one tile per layer — split into three maps so the
// decor overlay (rugs, moss, bloodstains) and the DM-only marker layer
// (secret doors, trap notes) never collide with or overwrite the
// mechanically-authoritative floor tile beneath them. gmOnlyNotes is keyed
// the same way, holding just the cells that have a note attached.
function tilesToLayerMaps(tiles: PlacedTile[]): {
  floor: Map<string, string>;
  decor: Map<string, string>;
  gmOnly: Map<string, string>;
  gmOnlyNotes: Map<string, string>;
} {
  const floor = new Map<string, string>();
  const decor = new Map<string, string>();
  const gmOnly = new Map<string, string>();
  const gmOnlyNotes = new Map<string, string>();
  for (const t of tiles) {
    const key = tileKey(t.x, t.y);
    if (t.layer === "decor") decor.set(key, t.tileId);
    else if (t.layer === "gmOnly") {
      gmOnly.set(key, t.tileId);
      if (t.note) gmOnlyNotes.set(key, t.note);
    } else floor.set(key, t.tileId);
  }
  return { floor, decor, gmOnly, gmOnlyNotes };
}

function layerMapsToTiles(
  floor: Map<string, string>,
  decor: Map<string, string>,
  gmOnly: Map<string, string>,
  gmOnlyNotes: Map<string, string>,
): PlacedTile[] {
  const out: PlacedTile[] = [];
  for (const [key, tileId] of floor) {
    const [x, y] = key.split(",").map(Number);
    out.push({ x, y, tileId });
  }
  for (const [key, tileId] of decor) {
    const [x, y] = key.split(",").map(Number);
    out.push({ x, y, tileId, layer: "decor" });
  }
  for (const [key, tileId] of gmOnly) {
    const [x, y] = key.split(",").map(Number);
    const note = gmOnlyNotes.get(key);
    out.push({ x, y, tileId, layer: "gmOnly", ...(note ? { note } : {}) });
  }
  return out;
}

export function MapBuilderPage() {
  const { worlds, worldId } = useActiveWorld();
  const [maps, setMaps] = useState<BattleMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWidth, setNewWidth] = useState(15);
  const [newHeight, setNewHeight] = useState(10);

  const [activeMap, setActiveMap] = useState<BattleMap | null>(null);
  const [floorTiles, setFloorTiles] = useState<Map<string, string>>(new Map());
  const [decorTiles, setDecorTiles] = useState<Map<string, string>>(new Map());
  const [gmOnlyTiles, setGmOnlyTiles] = useState<Map<string, string>>(new Map());
  const [gmOnlyNotes, setGmOnlyNotes] = useState<Map<string, string>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState(BATTLE_TILES[0].id);
  const [eraser, setEraser] = useState(false);
  const [name, setName] = useState("");
  const [saveWorldId, setSaveWorldId] = useState("");
  const [saveTags, setSaveTags] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saveHidden, setSaveHidden] = useState(false);
  const [saving, setSaving] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishStatus, setPublishStatus] = useState<"idle" | "saving" | "published">("idle");

  const svgRef = useRef<SVGSVGElement>(null);
  const paintingRef = useRef(false);

  function refresh() {
    setLoading(true);
    setError(null);
    api.listBattleMaps().then(setMaps).catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function confirmCreate() {
    if (!newName.trim()) return;
    setError(null);
    try {
      const created = await api.saveBattleMap({ name: newName.trim(), width: newWidth, height: newHeight, tiles: [], worldId: worldId || null });
      setCreating(false);
      setNewName("");
      refresh();
      openMap(created);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openMap(map: BattleMap) {
    setActiveMap(map);
    const { floor, decor, gmOnly, gmOnlyNotes: notes } = tilesToLayerMaps(map.tiles);
    setFloorTiles(floor);
    setDecorTiles(decor);
    setGmOnlyTiles(gmOnly);
    setGmOnlyNotes(notes);
    setDirty(false);
    setName(map.name);
    setSaveWorldId(map.worldId ?? "");
    setSaveTags(map.tags.join(", "));
    setSaveNotes(map.notes ?? "");
    setSaveHidden(map.hiddenFromParty);
    setEraser(false);
    setPublishOpen(false);
    setPublishStatus("idle");
  }

  function openPublish() {
    if (!activeMap) return;
    setPublishTitle(activeMap.name);
    setPublishDescription("");
    setPublishStatus("idle");
    setPublishOpen(true);
  }

  async function handlePublish() {
    if (!activeMap || !publishTitle.trim()) return;
    setPublishStatus("saving");
    setError(null);
    try {
      await api.publishEntry({
        entityType: "battleMap", entityId: activeMap.id,
        title: publishTitle.trim(), description: publishDescription.trim() || undefined,
      });
      setPublishStatus("published");
    } catch (e) {
      setError((e as Error).message);
      setPublishStatus("idle");
    }
  }

  function closeMap() {
    setActiveMap(null);
    refresh();
  }

  async function deleteMap(map: BattleMap, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${map.name}"? This can't be undone.`)) return;
    await api.deleteBattleMap(map.id);
    refresh();
  }

  function localCoords(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const screenPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: screenPt.x, y: screenPt.y };
  }

  const selectedLayer = layerForTile(selectedTileId);

  function paintAt(clientX: number, clientY: number) {
    if (!activeMap) return;
    const { x, y } = localCoords(clientX, clientY);
    const cellX = Math.floor(x / CELL);
    const cellY = Math.floor(y / CELL);
    if (cellX < 0 || cellY < 0 || cellX >= activeMap.width || cellY >= activeMap.height) return;
    const key = tileKey(cellX, cellY);
    if (eraser) {
      // Erase the top layer first (GM markers, then decor, then floor) —
      // same as most map tools, a repeated click on a bare floor tile
      // eventually clears it.
      if (gmOnlyTiles.has(key)) {
        setGmOnlyTiles((prev) => { const next = new Map(prev); next.delete(key); return next; });
        setGmOnlyNotes((prev) => { const next = new Map(prev); next.delete(key); return next; });
      } else if (decorTiles.has(key)) {
        setDecorTiles((prev) => { const next = new Map(prev); next.delete(key); return next; });
      } else {
        setFloorTiles((prev) => { const next = new Map(prev); next.delete(key); return next; });
      }
    } else if (selectedLayer === "gmOnly") {
      setGmOnlyTiles((prev) => new Map(prev).set(key, selectedTileId));
    } else if (selectedLayer === "decor") {
      setDecorTiles((prev) => new Map(prev).set(key, selectedTileId));
    } else {
      setFloorTiles((prev) => new Map(prev).set(key, selectedTileId));
    }
    setDirty(true);
  }

  function setGmOnlyNote(key: string, note: string) {
    setGmOnlyNotes((prev) => {
      const next = new Map(prev);
      if (note) next.set(key, note);
      else next.delete(key);
      return next;
    });
    setDirty(true);
  }

  function deleteGmOnlyMarker(key: string) {
    setGmOnlyTiles((prev) => { const next = new Map(prev); next.delete(key); return next; });
    setGmOnlyNotes((prev) => { const next = new Map(prev); next.delete(key); return next; });
    setDirty(true);
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    paintingRef.current = true;
    paintAt(e.clientX, e.clientY);
  }
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!paintingRef.current) return;
    paintAt(e.clientX, e.clientY);
  }
  function handlePointerUp() {
    paintingRef.current = false;
  }

  async function saveMap() {
    if (!activeMap) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateBattleMap(activeMap.id, {
        name,
        tiles: layerMapsToTiles(floorTiles, decorTiles, gmOnlyTiles, gmOnlyNotes),
        worldId: saveWorldId || null,
        tags: saveTags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: saveNotes || undefined,
        hiddenFromParty: saveHidden,
      });
      setActiveMap(updated);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const gridWidth = activeMap ? activeMap.width * CELL : 0;
  const gridHeight = activeMap ? activeMap.height * CELL : 0;

  function toPlacedList(map: Map<string, string>) {
    return [...map.entries()].map(([key, tileId]) => {
      const [x, y] = key.split(",").map(Number);
      return { key, x, y, tileId };
    });
  }
  const placedFloorTiles = useMemo(() => toPlacedList(floorTiles), [floorTiles]);
  const placedDecorTiles = useMemo(() => toPlacedList(decorTiles), [decorTiles]);
  const placedGmOnlyTiles = useMemo(() => toPlacedList(gmOnlyTiles), [gmOnlyTiles]);

  if (activeMap) {
    return (
      <div className="page">
        <div className="panel map-builder-header">
          <div className="page-title">
            <MapBuilderIcon className="page-title-icon" aria-hidden="true" />
            <h2>{activeMap.name}</h2>
          </div>
          <p className="hint">
            {activeMap.width}×{activeMap.height} tiles. Click, or click-and-drag, to paint. No uploaded images — every map here is hand-built from the tileset below.
            {" "}Decor tiles paint over a floor tile without replacing it, and never block movement or sight — good for rugs, moss, bloodstains.
            {" "}GM Only markers (secret doors, traps) are for your eyes alone — players never see them, in the builder or at the table.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="map-builder-actions">
            <button className="btn-secondary" onClick={closeMap}>← Back to My Maps</button>
            <button className="btn-primary" onClick={saveMap} disabled={saving || !dirty}>
              {saving ? "Saving…" : dirty ? "Save Map" : "Saved"}
            </button>
          </div>
        </div>

        <div className="map-builder-layout">
          <div className="panel map-builder-palette">
            <h3 className="section-heading">Tileset</h3>
            <button
              className={`tile-swatch-button ${eraser ? "active" : ""}`}
              onClick={() => setEraser(true)}
            >
              <span className="tile-swatch tile-eraser">✕</span>
              Eraser
            </button>
            {CATEGORIES.map((category) => (
              <div key={category} className="tile-category">
                <h4 className="tile-category-heading">{CATEGORY_LABELS[category]}</h4>
                <div className="tile-swatch-grid">
                  {BATTLE_TILES.filter((t) => t.category === category).map((tile) => (
                    <button
                      key={tile.id}
                      className={`tile-swatch-button ${!eraser && selectedTileId === tile.id ? "active" : ""}`}
                      onClick={() => { setSelectedTileId(tile.id); setEraser(false); }}
                      title={tile.name}
                    >
                      <TileSwatch tileId={tile.id} />
                      {tile.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="panel map-builder-canvas-panel">
            <div className="map-builder-canvas-scroll">
              <svg
                ref={svgRef}
                width={gridWidth}
                height={gridHeight}
                viewBox={`0 0 ${gridWidth} ${gridHeight}`}
                className="map-builder-svg"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <BattleTileDefs />
                <rect width={gridWidth} height={gridHeight} className="map-builder-bg" />
                {Array.from({ length: activeMap.width + 1 }, (_, i) => (
                  <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={gridHeight} className="map-builder-grid-line" />
                ))}
                {Array.from({ length: activeMap.height + 1 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * CELL} x2={gridWidth} y2={i * CELL} className="map-builder-grid-line" />
                ))}
                {placedFloorTiles.map((t) => (
                  <use key={t.key} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} />
                ))}
                {placedDecorTiles.map((t) => (
                  <use key={`decor-${t.key}`} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} pointerEvents="none" />
                ))}
                {placedGmOnlyTiles.map((t) => (
                  <use key={`gm-${t.key}`} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} pointerEvents="none" />
                ))}
              </svg>
            </div>
          </div>

          <div className="panel map-builder-details">
            <h3 className="section-heading">Map Details</h3>
            <label className="field">
              <span>Name</span>
              <input type="text" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
            </label>
            <SaveEntityFields
              worlds={worlds} worldId={saveWorldId} setWorldId={(id) => { setSaveWorldId(id); setDirty(true); }}
              tags={saveTags} setTags={(t) => { setSaveTags(t); setDirty(true); }} tagsPlaceholder="dungeon, act-1"
              notes={saveNotes} setNotes={(n) => { setSaveNotes(n); setDirty(true); }}
              hiddenFromParty={saveHidden} setHiddenFromParty={(h) => { setSaveHidden(h); setDirty(true); }}
            />
            <div className="button-row">
              <button className="btn-secondary" onClick={openPublish} disabled={dirty}>Publish to Gallery</button>
            </div>
            {dirty && <p className="hint">Save your changes before publishing.</p>}

            {placedGmOnlyTiles.length > 0 && (
              <div className="gm-markers-panel">
                <h3 className="section-heading">GM Markers</h3>
                <p className="hint">Only you ever see these — stripped before a map reaches any player.</p>
                <ul className="gm-markers-list">
                  {placedGmOnlyTiles.map((t) => (
                    <li key={t.key} className="gm-marker-row">
                      <div className="gm-marker-row-header">
                        <TileSwatch tileId={t.tileId} size={20} />
                        <span className="entity-name">{BATTLE_TILE_BY_ID[t.tileId]?.name ?? t.tileId}</span>
                        <span className="entity-meta">({t.x}, {t.y})</span>
                        <button className="btn-secondary" onClick={() => deleteGmOnlyMarker(t.key)}>Delete</button>
                      </div>
                      <textarea
                        placeholder="Note (why it's secret, what it does)…"
                        value={gmOnlyNotes.get(t.key) ?? ""}
                        onChange={(e) => setGmOnlyNote(t.key, e.target.value)}
                        rows={2}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {publishOpen && (
              <div className="save-panel">
                <h3 className="section-heading">Publish to Gallery</h3>
                <p className="hint">Anyone signed in will be able to view and clone this into their own maps.</p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="page-title">
          <MapBuilderIcon className="page-title-icon" aria-hidden="true" />
          <h2>Map Builder</h2>
        </div>
        <p className="hint">Hand-build battle maps from a curated tileset — no image uploads. Paint terrain, walls, and hazards tile by tile, save, and reuse them across sessions.</p>
        {error && <p className="error">{error}</p>}

        {!creating && <button className="btn-primary" onClick={() => setCreating(true)}>+ New Map</button>}
        {creating && (
          <div className="save-panel">
            <label className="field">
              <span>Name</span>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Goblin Ambush" />
            </label>
            <label className="field">
              <span>Width (tiles, max {BATTLE_MAP_MAX_WIDTH})</span>
              <input type="number" min={1} max={BATTLE_MAP_MAX_WIDTH} value={newWidth} onChange={(e) => setNewWidth(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Height (tiles, max {BATTLE_MAP_MAX_HEIGHT})</span>
              <input type="number" min={1} max={BATTLE_MAP_MAX_HEIGHT} value={newHeight} onChange={(e) => setNewHeight(Number(e.target.value))} />
            </label>
            <div className="map-builder-actions">
              <button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn-primary" onClick={confirmCreate} disabled={!newName.trim()}>Create</button>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="panel"><p className="hint">Loading…</p></div>}

      {!loading && maps.length === 0 && (
        <div className="panel">
          <EmptyState icon={<MapBuilderIcon />} heading="No battle maps yet" hint="Create your first hand-built map above." />
        </div>
      )}

      {!loading && maps.length > 0 && (
        <div className="panel">
          <ul className="entity-list">
            {maps.map((map) => (
              <li key={map.id} className="tavern-row" onClick={() => openMap(map)} style={{ cursor: "pointer" }}>
                <span className="entity-name">{map.name}</span>
                <span className="entity-meta">{map.width}×{map.height}</span>
                <button className="btn-secondary" onClick={(e) => deleteMap(map, e)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
