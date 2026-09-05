import { useEffect, useMemo, useRef, useState } from "react";
import type { BattleMap, PlacedTile, TileCategory, TilePack } from "@spark/shared";
import { BATTLE_TILES, BATTLE_TILE_BY_ID, BATTLE_MAP_MAX_WIDTH, BATTLE_MAP_MAX_HEIGHT, battleMapToUvtt, uvttToBattleMapInput } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { MapBuilderIcon } from "../components/icons";
import { BattleTileDefs, SpanTile, TileSwatch, spanDeckAngles } from "../components/TileIcon";
import { TileShading, TileShadingDefs, buildTileShading } from "../components/TileShading";
import { EmptyState } from "../components/EmptyState";
import { SaveEntityFields } from "../components/SaveEntityFields";

// Flat reference colors for the VTT export's background image — not a
// pixel-perfect render of Spark's tile icons (those are SVGs designed for
// crisp display at small sizes, not for baking into a raster background),
// just enough for a DM to see room shapes and terrain at a glance once
// the file is open in their own VTT. Only the mechanical layers are drawn,
// floor then span: decor sits cosmetically on top of a floor tile and
// gmOnly markers are the DM's own secret annotations, neither of which
// defines what a cell "is". A bridge does, so it paints over its chasm
// here the same way it does on the grid.
const CATEGORY_EXPORT_COLOR: Record<TileCategory, string> = {
  terrain: "#5f8a4a",
  structure: "#6b6b66",
  nature: "#3a6b30",
  hazard: "#a8442f",
  decor: "#5f8a4a",
  gmOnly: "#5f8a4a",
};
const EXPORT_PIXELS_PER_CELL = 70;

function renderBattleMapBackgroundImage(width: number, height: number, floorTiles: Map<string, string>, spanTiles: Map<string, string>): string {
  const canvas = document.createElement("canvas");
  canvas.width = width * EXPORT_PIXELS_PER_CELL;
  canvas.height = height * EXPORT_PIXELS_PER_CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = CATEGORY_EXPORT_COLOR.terrain;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const layer of [floorTiles, spanTiles]) {
    for (const [key, tileId] of layer) {
      const [x, y] = key.split(",").map(Number);
      const category = BATTLE_TILE_BY_ID[tileId]?.category ?? "terrain";
      ctx.fillStyle = CATEGORY_EXPORT_COLOR[category];
      ctx.fillRect(x * EXPORT_PIXELS_PER_CELL, y * EXPORT_PIXELS_PER_CELL, EXPORT_PIXELS_PER_CELL, EXPORT_PIXELS_PER_CELL);
    }
  }
  // Strip the "data:image/png;base64," prefix — UVTT's image field wants
  // bare base64.
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

function downloadVttFile(filename: string, doc: unknown) {
  const blob = new Blob([JSON.stringify(doc)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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

const PACK_LABELS: Record<TilePack, string> = {
  dungeon: "Dungeon",
  wilderness: "Wilderness",
};
const PACKS = Object.keys(PACK_LABELS) as TilePack[];

// The tileset never changes at runtime, so group it by pack and category
// once at module load rather than re-filtering the whole list per category
// on every render — the palette is otherwise rebuilt on each pointermove
// of a paint stroke, which is when this page re-renders most.
const TILES_BY_PACK_AND_CATEGORY: Record<TilePack, Record<TileCategory, typeof BATTLE_TILES>> =
  Object.fromEntries(PACKS.map((pack) => [
    pack,
    Object.fromEntries(CATEGORIES.map((category) => [
      category,
      BATTLE_TILES.filter((t) => t.pack === pack && t.category === category),
    ])) as Record<TileCategory, typeof BATTLE_TILES>,
  ])) as Record<TilePack, Record<TileCategory, typeof BATTLE_TILES>>;

function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

function layerForTile(tileId: string): "floor" | "span" | "decor" | "gmOnly" {
  const def = BATTLE_TILE_BY_ID[tileId];
  if (def?.category === "decor") return "decor";
  if (def?.category === "gmOnly") return "gmOnly";
  // A bridge lays over the ground rather than instead of it — the tile
  // itself declares that (see TileDef.span), so the palette needs no
  // separate layer control for it to land in the right place.
  if (def?.span) return "span";
  return "floor";
}

// A cell can hold at most one tile per layer — split into four maps so a
// span (a bridge over a chasm), the decor overlay (rugs, moss,
// bloodstains) and the DM-only marker layer (secret doors, trap notes)
// never collide with or overwrite the floor tile beneath them.
// gmOnlyNotes is keyed the same way, holding just the cells that have a
// note attached. Elevation is stamped onto the cell's *standing* tile —
// the span where there is one, the floor otherwise — which is the same
// placement the rules engine reads (see mapCells.ts).
interface LayerMaps {
  floor: Map<string, string>;
  span: Map<string, string>;
  decor: Map<string, string>;
  gmOnly: Map<string, string>;
  gmOnlyNotes: Map<string, string>;
  elevation: Map<string, number>;
}

function tilesToLayerMaps(tiles: PlacedTile[]): LayerMaps {
  const floor = new Map<string, string>();
  const span = new Map<string, string>();
  const decor = new Map<string, string>();
  const gmOnly = new Map<string, string>();
  const gmOnlyNotes = new Map<string, string>();
  const elevation = new Map<string, number>();
  for (const t of tiles) {
    const key = tileKey(t.x, t.y);
    if (t.layer === "decor") decor.set(key, t.tileId);
    else if (t.layer === "gmOnly") {
      gmOnly.set(key, t.tileId);
      if (t.note) gmOnlyNotes.set(key, t.note);
    } else if (t.layer === "span" || BATTLE_TILE_BY_ID[t.tileId]?.span) {
      // Lifting a bridge saved on the floor layer (every map built before
      // the span layer existed) onto the span layer here is what lets the
      // DM now paint the chasm back underneath it. Re-saving persists it.
      span.set(key, t.tileId);
      if (t.elevation !== undefined) elevation.set(key, t.elevation);
    } else {
      floor.set(key, t.tileId);
      if (t.elevation !== undefined) elevation.set(key, t.elevation);
    }
  }
  return { floor, span, decor, gmOnly, gmOnlyNotes, elevation };
}

function layerMapsToTiles(maps: LayerMaps): PlacedTile[] {
  const out: PlacedTile[] = [];
  const at = (key: string) => key.split(",").map(Number) as [number, number];
  for (const [key, tileId] of maps.floor) {
    const [x, y] = at(key);
    // A cell's height belongs to whatever is standing there, so a spanned
    // cell's stamp rides on the span and the floor below stays unauthored.
    const elevation = maps.span.has(key) ? undefined : maps.elevation.get(key);
    out.push({ x, y, tileId, ...(elevation !== undefined ? { elevation } : {}) });
  }
  for (const [key, tileId] of maps.span) {
    const [x, y] = at(key);
    const elevation = maps.elevation.get(key);
    out.push({ x, y, tileId, layer: "span", ...(elevation !== undefined ? { elevation } : {}) });
  }
  for (const [key, tileId] of maps.decor) {
    const [x, y] = at(key);
    out.push({ x, y, tileId, layer: "decor" });
  }
  for (const [key, tileId] of maps.gmOnly) {
    const [x, y] = at(key);
    const note = maps.gmOnlyNotes.get(key);
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
  const [spanTiles, setSpanTiles] = useState<Map<string, string>>(new Map());
  const [decorTiles, setDecorTiles] = useState<Map<string, string>>(new Map());
  const [gmOnlyTiles, setGmOnlyTiles] = useState<Map<string, string>>(new Map());
  const [gmOnlyNotes, setGmOnlyNotes] = useState<Map<string, string>>(new Map());
  const [cellElevation, setCellElevation] = useState<Map<string, number>>(new Map());
  const [brushElevation, setBrushElevation] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState(BATTLE_TILES[0].id);
  const [activePack, setActivePack] = useState<TilePack>("dungeon");
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

  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  async function importFromVtt(file: File) {
    setImporting(true);
    setError(null);
    try {
      const text = await file.text();
      const doc = JSON.parse(text);
      const baseName = file.name.replace(/\.(dd2vtt|uvtt|json)$/i, "") || "Imported Map";
      const input = uvttToBattleMapInput(doc, baseName);
      const created = await api.saveBattleMap({ ...input, worldId: worldId || null });
      refresh();
      openMap(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  function openMap(map: BattleMap) {
    setActiveMap(map);
    const { floor, span, decor, gmOnly, gmOnlyNotes: notes, elevation } = tilesToLayerMaps(map.tiles);
    setFloorTiles(floor);
    setSpanTiles(span);
    setDecorTiles(decor);
    setGmOnlyTiles(gmOnly);
    setGmOnlyNotes(notes);
    setCellElevation(elevation);
    setBrushElevation(0);
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
    const without = (prev: Map<string, string>) => { const next = new Map(prev); next.delete(key); return next; };
    const stampElevation = () => setCellElevation((prev) => {
      const next = new Map(prev);
      if (brushElevation !== 0) next.set(key, brushElevation);
      else next.delete(key);
      return next;
    });

    if (eraser) {
      // Peel the top layer first (GM markers, then decor, then a span, then
      // the floor) — same as most map tools, a repeated click on a bare
      // floor tile eventually clears it. Taking a bridge off this way is
      // what puts the chasm underneath back on show, rather than leaving a
      // hole where the terrain used to be.
      if (gmOnlyTiles.has(key)) {
        setGmOnlyTiles(without);
        setGmOnlyNotes(without);
      } else if (decorTiles.has(key)) {
        setDecorTiles(without);
      } else if (spanTiles.has(key)) {
        setSpanTiles(without);
        if (!floorTiles.has(key)) setCellElevation((prev) => { const next = new Map(prev); next.delete(key); return next; });
      } else {
        setFloorTiles(without);
        setCellElevation((prev) => { const next = new Map(prev); next.delete(key); return next; });
      }
    } else if (selectedLayer === "gmOnly") {
      setGmOnlyTiles((prev) => new Map(prev).set(key, selectedTileId));
    } else if (selectedLayer === "decor") {
      setDecorTiles((prev) => new Map(prev).set(key, selectedTileId));
    } else if (selectedLayer === "span") {
      setSpanTiles((prev) => new Map(prev).set(key, selectedTileId));
      stampElevation();
    } else {
      setFloorTiles((prev) => new Map(prev).set(key, selectedTileId));
      // Painting ground under an existing bridge changes what the bridge
      // crosses, not what anyone standing on it is standing on — so leave
      // the span's own height alone.
      if (!spanTiles.has(key)) stampElevation();
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

  const layerMaps = (): LayerMaps => ({
    floor: floorTiles, span: spanTiles, decor: decorTiles,
    gmOnly: gmOnlyTiles, gmOnlyNotes, elevation: cellElevation,
  });

  function exportToVtt() {
    if (!activeMap) return;
    const tiles = layerMapsToTiles(layerMaps());
    const image = renderBattleMapBackgroundImage(activeMap.width, activeMap.height, floorTiles, spanTiles);
    const doc = battleMapToUvtt({ width: activeMap.width, height: activeMap.height, tiles }, image);
    downloadVttFile(`${activeMap.name.trim() || "battle-map"}.dd2vtt`, doc);
  }

  async function saveMap() {
    if (!activeMap) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateBattleMap(activeMap.id, {
        name,
        tiles: layerMapsToTiles(layerMaps()),
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
  // Pure geometry, fixed for a given map size — rebuilt once per map rather
  // than on every frame of a paint stroke.
  const gridLines = useMemo(() => {
    if (!activeMap) return null;
    const w = activeMap.width * CELL;
    const h = activeMap.height * CELL;
    return (
      <>
        {Array.from({ length: activeMap.width + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={h} className="map-builder-grid-line" />
        ))}
        {Array.from({ length: activeMap.height + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * CELL} x2={w} y2={i * CELL} className="map-builder-grid-line" />
        ))}
      </>
    );
  }, [activeMap]);

  // Depends only on which pack is open and which swatch is selected — none
  // of which change mid-stroke — so the 58 swatch buttons and their inline
  // SVGs survive a paint drag untouched instead of being rebuilt per frame.
  const paletteCategories = useMemo(() => CATEGORIES.map((category) => (
    <div key={category} className="tile-category">
      <h4 className="tile-category-heading">{CATEGORY_LABELS[category]}</h4>
      <div className="tile-swatch-grid">
        {TILES_BY_PACK_AND_CATEGORY[activePack][category].map((tile) => (
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
  )), [activePack, selectedTileId, eraser]);

  const placedFloorTiles = useMemo(() => toPlacedList(floorTiles), [floorTiles]);
  const placedSpanTiles = useMemo(() => toPlacedList(spanTiles), [spanTiles]);
  const spanCells = useMemo(() => new Set(spanTiles.keys()), [spanTiles]);
  const placedDecorTiles = useMemo(() => toPlacedList(decorTiles), [decorTiles]);
  const placedGmOnlyTiles = useMemo(() => toPlacedList(gmOnlyTiles), [gmOnlyTiles]);
  const shading = useMemo(
    () => (activeMap ? buildTileShading(
      [
        ...placedFloorTiles.map((t) => ({ x: t.x, y: t.y, tileId: t.tileId })),
        ...placedSpanTiles.map((t) => ({ x: t.x, y: t.y, tileId: t.tileId, layer: "span" as const })),
      ],
      activeMap.width, activeMap.height, CELL,
    ) : null),
    [placedFloorTiles, placedSpanTiles, activeMap],
  );


  const placedElevationLabels = useMemo(
    () => [...cellElevation.entries()].map(([key, elevation]) => {
      const [x, y] = key.split(",").map(Number);
      return { key, x, y, elevation };
    }),
    [cellElevation],
  );

  if (activeMap) {
    return (
      <div className="page">
        <div className="panel map-builder-header">
          <div className="page-title">
            <MapBuilderIcon className="page-title-icon" aria-hidden="true" />
            <h2>{activeMap.name}</h2>
          </div>
          <p className="hint">
            {activeMap.width}×{activeMap.height} tiles. Click, or click-and-drag, to paint. No uploaded images. Every map here is hand-built from the tileset below.
            {" "}Decor tiles paint over a floor tile without replacing it, and never block movement or sight, good for rugs, moss, bloodstains.
            {" "}Bridges lay across the ground the same way: paint a Chasm, then a Bridge over it, and the chasm still runs underneath and comes back if you erase the deck.
            {" "}GM Only markers (secret doors, traps) are for your eyes alone. Players never see them, in the builder or at the table.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="map-builder-actions">
            <button className="btn-secondary" onClick={closeMap}>← Back to My Maps</button>
            <button className="btn-secondary" onClick={exportToVtt} title="Download as a Universal VTT (.dd2vtt) file to import into Foundry, DungeonFog, or another VTT">
              Export to VTT
            </button>
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
            <label className="field">
              <span>Elevation (ft)</span>
              <input
                type="number"
                step={5}
                value={brushElevation}
                onChange={(e) => setBrushElevation(Number(e.target.value) || 0)}
              />
            </label>
            <p className="hint">
              Stamped onto tiles as you paint. Leave at 0 for ground level. A negative elevation on an
              otherwise-solid tile (like Chasm) also lets a flying combatant cross it during combat. On a
              cell with a bridge over it, the height belongs to the bridge — that's what anyone crossing
              is standing on.
            </p>
            <div className="tile-pack-selector">
              {PACKS.map((pack) => (
                <button
                  key={pack}
                  className={`tile-pack-button ${activePack === pack ? "active" : ""}`}
                  onClick={() => setActivePack(pack)}
                >
                  {PACK_LABELS[pack]}
                </button>
              ))}
            </div>
            {paletteCategories}
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
                <defs><TileShadingDefs /></defs>
                <rect width={gridWidth} height={gridHeight} className="map-builder-bg" />
                {gridLines}
                {placedFloorTiles.map((t) => (
                  <use key={t.key} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} />
                ))}
                {placedSpanTiles.map((t) => (
                  <SpanTile key={`span-${t.key}`} tileId={t.tileId} x={t.x} y={t.y} cell={CELL} angles={spanDeckAngles(spanCells, t.x, t.y)} />
                ))}
                {shading && <TileShading shading={shading} />}
                {placedDecorTiles.map((t) => (
                  <use key={`decor-${t.key}`} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} pointerEvents="none" />
                ))}
                {placedGmOnlyTiles.map((t) => (
                  <use key={`gm-${t.key}`} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} pointerEvents="none" />
                ))}
                {placedElevationLabels.map((t) => (
                  <text key={`elev-${t.key}`} x={t.x * CELL + CELL - 2} y={t.y * CELL + 9} className="grid-map-elevation-label" textAnchor="end" pointerEvents="none">
                    {t.elevation > 0 ? `+${t.elevation}` : t.elevation}
                  </text>
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
                <p className="hint">Only you ever see these. Stripped before a map reaches any player.</p>
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
                {publishStatus === "published" && <p className="success">Published. Visible in the Homebrew Gallery.</p>}
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
        <p className="hint">Hand-build battle maps from a curated tileset. No image uploads. Paint terrain, walls, and hazards tile by tile, save, and reuse them across sessions.</p>
        {error && <p className="error">{error}</p>}

        {!creating && (
          <div className="button-row">
            <button className="btn-primary" onClick={() => setCreating(true)}>+ New Map</button>
            <button
              className="btn-secondary"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              title="Import a Universal VTT (.dd2vtt/.uvtt) file exported from Foundry, DungeonFog, or another VTT"
            >
              {importing ? "Importing…" : "Import from VTT"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".dd2vtt,.uvtt,.json,application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFromVtt(file);
                e.target.value = "";
              }}
            />
          </div>
        )}
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
