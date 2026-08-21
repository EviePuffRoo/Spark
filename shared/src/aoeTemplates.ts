// Area-of-effect templates for the battle grid: a DM (or a player on their
// own turn) picks a shape, then places it with the same two-click gesture
// the ruler already uses — click the origin, click a second point to aim
// and size it. All in grid-tile units (not feet): the size IS however far
// the second click lands from the origin, so there's no separate size
// input to fill in.
export type AoeShapeKind = "circle" | "square" | "cone" | "line";

export const AOE_SHAPE_KINDS: AoeShapeKind[] = ["circle", "square", "cone", "line"];

export interface AoeTemplate {
  kind: AoeShapeKind;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

// A line template's width, in tiles — fixed rather than a third
// configurable input, same simplification tradeoff as chebyshevDistanceFeet
// picking one of the two official movement-cost rules: close enough to
// the tabletop feel without another field for the DM to fill in.
const LINE_WIDTH_TILES = 1;

// Half the cone's total angular spread, in radians — 45 degrees either
// side of the aim direction, giving a 90-degree cone (5e's usual cone
// angle).
const CONE_HALF_ANGLE = Math.PI / 4;

// Every "x,y" key covered by a template, clipped to the map's bounds.
// Distances are measured center-to-center in tile units; a cell counts as
// included once its center falls inside the shape, which is the same
// "good enough at tabletop scale" approach vision.ts's circular radius
// check uses.
export function computeAoeCells(map: { width: number; height: number }, template: AoeTemplate): Set<string> {
  const { kind, originX, originY, targetX, targetY } = template;
  const cells = new Set<string>();
  const dx = targetX - originX;
  const dy = targetY - originY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  const add = (x: number, y: number) => { if (inBounds(x, y)) cells.add(key(x, y)); };

  if (dist === 0) {
    add(originX, originY);
    return cells;
  }

  if (kind === "circle") {
    const r = dist;
    const rCeil = Math.ceil(r);
    for (let cy = originY - rCeil; cy <= originY + rCeil; cy++) {
      for (let cx = originX - rCeil; cx <= originX + rCeil; cx++) {
        const ddx = cx - originX;
        const ddy = cy - originY;
        if (ddx * ddx + ddy * ddy <= r * r) add(cx, cy);
      }
    }
    return cells;
  }

  if (kind === "square") {
    const half = Math.max(0, Math.round(dist));
    for (let cy = originY - half; cy <= originY + half; cy++) {
      for (let cx = originX - half; cx <= originX + half; cx++) add(cx, cy);
    }
    return cells;
  }

  // Cone and line both project candidate cells onto the aim direction —
  // shared setup, different inclusion tests below.
  const ux = dx / dist;
  const uy = dy / dist;
  const radius = Math.ceil(dist);

  if (kind === "cone") {
    const aimAngle = Math.atan2(dy, dx);
    for (let cy = originY - radius; cy <= originY + radius; cy++) {
      for (let cx = originX - radius; cx <= originX + radius; cx++) {
        const ddx = cx - originX;
        const ddy = cy - originY;
        const cellDist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (cellDist > dist) continue;
        if (cellDist === 0) { add(cx, cy); continue; }
        let angleDiff = Math.abs(Math.atan2(ddy, ddx) - aimAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        if (angleDiff <= CONE_HALF_ANGLE) add(cx, cy);
      }
    }
    return cells;
  }

  // line
  const halfWidth = LINE_WIDTH_TILES / 2;
  for (let cy = originY - radius - 1; cy <= originY + radius + 1; cy++) {
    for (let cx = originX - radius - 1; cx <= originX + radius + 1; cx++) {
      const ddx = cx - originX;
      const ddy = cy - originY;
      const along = ddx * ux + ddy * uy;
      if (along < 0 || along > dist) continue;
      const perp = Math.abs(ddx * -uy + ddy * ux);
      if (perp <= halfWidth) add(cx, cy);
    }
  }
  return cells;
}

// The "x,y" keys a combatant actually occupies, honoring its footprint
// (a large/huge/gargantuan creature covers more than one cell) — used to
// check whether ANY of its occupied cells falls inside a placed template,
// not just its top-left anchor.
export function footprintCells(gridX: number, gridY: number, size: number): string[] {
  const cells: string[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) cells.push(key(gridX + dx, gridY + dy));
  }
  return cells;
}

export function footprintIntersectsTemplate(gridX: number, gridY: number, size: number, templateCells: Set<string>): boolean {
  return footprintCells(gridX, gridY, size).some((c) => templateCells.has(c));
}
