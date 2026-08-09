import { useEffect, useRef, useState } from "react";
import {
  forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide,
  type Simulation, type SimulationNodeDatum, type SimulationLinkDatum,
} from "d3-force";
import type { Faction, EntityType } from "@spark/shared";
import { computeReputationTier } from "@spark/shared";
import { api } from "../api";

interface WebNode extends SimulationNodeDatum {
  id: string;
  entityType: "faction" | "character" | "playerCharacter";
  name: string;
  reputationTier?: ReturnType<typeof computeReputationTier>;
}

interface WebEdge extends SimulationLinkDatum<WebNode> {
  id: string;
  label?: string;
}

const WIDTH = 800;
const HEIGHT = 560;
const FACTION_RADIUS = 26;
const CHARACTER_RADIUS = 15;

function jitteredCenter() {
  return { x: WIDTH / 2 + (Math.random() - 0.5) * 60, y: HEIGHT / 2 + (Math.random() - 0.5) * 60 };
}

export function FactionWebView({
  factions, onSelectEntity, onClose,
}: {
  factions: Faction[];
  onSelectEntity: (type: EntityType, id: string) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<WebEdge | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const nodesRef = useRef<WebNode[]>([]);
  const edgesRef = useRef<WebEdge[]>([]);
  const simRef = useRef<Simulation<WebNode, WebEdge> | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const factionIds = factions.map((f) => f.id).join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      factions.map((f) => api.getLinks("faction", f.id).then((links) => ({ factionId: f.id, links }))),
    ).then((results) => {
      if (cancelled) return;

      const nodeById = new Map<string, WebNode>();
      for (const f of factions) {
        nodeById.set(f.id, { id: f.id, entityType: "faction", name: f.name, reputationTier: computeReputationTier(f.reputation), ...jitteredCenter() });
      }

      const edgeById = new Map<string, WebEdge>();
      for (const { factionId, links } of results) {
        for (const link of links) {
          if (link.other.type !== "faction" && link.other.type !== "character" && link.other.type !== "playerCharacter") continue;
          if (edgeById.has(link.id)) continue;
          if (!nodeById.has(link.other.id)) {
            nodeById.set(link.other.id, { id: link.other.id, entityType: link.other.type, name: link.other.name, ...jitteredCenter() });
          }
          edgeById.set(link.id, { id: link.id, label: link.label, source: factionId, target: link.other.id });
        }
      }

      const nodes = Array.from(nodeById.values());
      const edges = Array.from(edgeById.values());
      nodesRef.current = nodes;
      edgesRef.current = edges;

      simRef.current?.stop();
      simRef.current = forceSimulation(nodes)
        .force("charge", forceManyBody().strength(-260))
        .force("link", forceLink<WebNode, WebEdge>(edges).id((d) => d.id).distance(130))
        .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
        .force("collide", forceCollide<WebNode>().radius((d) => (d.entityType === "faction" ? FACTION_RADIUS : CHARACTER_RADIUS) + 10))
        .on("tick", () => setTick((t) => t + 1));

      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      cancelled = true;
      simRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factionIds]);

  function toLocalCoords(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const screenPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const t = transformRef.current;
    return { x: (screenPt.x - t.x) / t.k, y: (screenPt.y - t.y) / t.k };
  }

  function handleNodePointerDown(e: React.PointerEvent<SVGGElement>, node: WebNode) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: node.id, startX: e.clientX, startY: e.clientY, moved: false };
    simRef.current?.alphaTarget(0.3).restart();
  }

  function handleNodePointerMove(e: React.PointerEvent<SVGGElement>, node: WebNode) {
    const drag = dragRef.current;
    if (!drag || drag.id !== node.id) return;
    if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    const { x, y } = toLocalCoords(e.clientX, e.clientY);
    node.fx = x;
    node.fy = y;
    setTick((t) => t + 1);
  }

  function handleNodePointerUp(_e: React.PointerEvent<SVGGElement>, node: WebNode) {
    const drag = dragRef.current;
    simRef.current?.alphaTarget(0);
    dragRef.current = null;
    if (drag && drag.id === node.id && !drag.moved) {
      onSelectEntity(node.entityType, node.id);
    }
  }

  function handleBackgroundPointerDown(e: React.PointerEvent<SVGRectElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, originX: transform.x, originY: transform.y };
  }

  function handleBackgroundPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const pan = panRef.current;
    if (!pan) return;
    setTransform((t) => ({ ...t, x: pan.originX + (e.clientX - pan.startX), y: pan.originY + (e.clientY - pan.startY) }));
  }

  function handleBackgroundPointerUp() {
    panRef.current = null;
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    const delta = -e.deltaY * 0.001;
    setTransform((t) => ({ ...t, k: Math.min(2.5, Math.max(0.3, t.k * (1 + delta))) }));
  }

  const nodes = nodesRef.current;
  const edges = edgesRef.current;
  const neighborIds = hoveredNodeId
    ? new Set(
        edges
          .filter((e) => nodeId(e.source) === hoveredNodeId || nodeId(e.target) === hoveredNodeId)
          .flatMap((e) => [nodeId(e.source), nodeId(e.target)])
          .concat(hoveredNodeId),
      )
    : null;

  return (
    <div className="faction-web">
      <div className="faction-web-header">
        <h2>Faction Relationship Web</h2>
        <button className="btn-secondary" onClick={onClose}>Back to Roster</button>
      </div>

      {loading && <p className="hint">Loading relationships…</p>}
      {!loading && nodes.length === 0 && <p className="hint">No factions to show yet.</p>}

      {!loading && nodes.length > 0 && (
        <div className="faction-web-canvas">
          <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="faction-web-svg" onWheel={handleWheel}>
            <rect
              x={0} y={0} width={WIDTH} height={HEIGHT} fill="transparent"
              onPointerDown={handleBackgroundPointerDown}
              onPointerMove={handleBackgroundPointerMove}
              onPointerUp={handleBackgroundPointerUp}
            />
            <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
              {edges.map((edge) => {
                const source = edge.source as WebNode;
                const target = edge.target as WebNode;
                if (typeof source === "string" || typeof target === "string") return null;
                const dimmed = neighborIds ? !neighborIds.has(source.id) || !neighborIds.has(target.id) : false;
                return (
                  <line
                    key={edge.id}
                    x1={source.x ?? 0} y1={source.y ?? 0} x2={target.x ?? 0} y2={target.y ?? 0}
                    className={`faction-web-edge${dimmed ? " dimmed" : ""}${hoveredEdge?.id === edge.id ? " hovered" : ""}`}
                    onPointerEnter={() => setHoveredEdge(edge)}
                    onPointerLeave={() => setHoveredEdge((cur) => (cur?.id === edge.id ? null : cur))}
                  />
                );
              })}
              {nodes.map((node) => {
                const dimmed = neighborIds ? !neighborIds.has(node.id) : false;
                const radius = node.entityType === "faction" ? FACTION_RADIUS : CHARACTER_RADIUS;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x ?? 0} ${node.y ?? 0})`}
                    className={`faction-web-node ${node.entityType}${node.reputationTier ? ` rep-${node.reputationTier}` : ""}${dimmed ? " dimmed" : ""}`}
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                    onPointerMove={(e) => handleNodePointerMove(e, node)}
                    onPointerUp={(e) => handleNodePointerUp(e, node)}
                    onPointerEnter={() => setHoveredNodeId(node.id)}
                    onPointerLeave={() => setHoveredNodeId((cur) => (cur === node.id ? null : cur))}
                  >
                    <circle r={radius} />
                    <text y={radius + 14}>{node.name}</text>
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="faction-web-legend">
            <span><i className="faction-web-swatch faction" />Faction</span>
            <span><i className="faction-web-swatch character" />NPC/Monster</span>
            <span><i className="faction-web-swatch playerCharacter" />Player Character</span>
          </div>
          <div className="faction-web-legend faction-web-reputation-legend">
            <span>Reputation:</span>
            <span><i className="faction-web-swatch rep-hostile" />Hostile</span>
            <span><i className="faction-web-swatch rep-unfriendly" />Unfriendly</span>
            <span><i className="faction-web-swatch rep-neutral" />Neutral</span>
            <span><i className="faction-web-swatch rep-friendly" />Friendly</span>
            <span><i className="faction-web-swatch rep-allied" />Allied</span>
          </div>

          {hoveredEdge && (
            <div className="faction-web-tooltip">
              {(hoveredEdge.source as WebNode).name} → {(hoveredEdge.target as WebNode).name}
              {hoveredEdge.label ? `: ${hoveredEdge.label}` : ": no label yet"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function nodeId(ref: WebEdge["source"]): string {
  return typeof ref === "object" ? (ref as WebNode).id : String(ref);
}
