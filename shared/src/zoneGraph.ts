// The zone graph: which zones are next to which, and how far apart.
//
// A zone's links live in its own `connections` array, but a link means the
// same thing from either end — so the *stored* form can be one-sided while
// every reader treats it as symmetric. That split is the reason this module
// exists in one place: the adjacency test was previously written out inline
// in the server's move-zone route and rebuilt again, differently, in the
// client's distance helper, which is exactly how a server and a client come
// to disagree about whether the party can walk somewhere.
//
// Generic over any {id, connections} shape, so it serves Region.connections
// on the World Map as well as EncounterZone on the battle side.

interface ConnectedNode {
  id: string;
  connections: string[];
}

// Are these two nodes linked? Either side listing the other counts. Kept
// deliberately tolerant of a one-sided link: encounters saved before
// toggleZoneConnection wrote both ends still hold them, and a party that
// could walk between two zones yesterday must still be able to today.
export function areZonesAdjacent(nodes: ConnectedNode[], aId: string, bId: string): boolean {
  const a = nodes.find((n) => n.id === aId);
  const b = nodes.find((n) => n.id === bId);
  return !!(a?.connections.includes(bId) || b?.connections.includes(aId));
}

// Breadth-first hop count from one node to every node it can reach.
export function zoneDistances(nodes: ConnectedNode[], fromZoneId: string): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const zone of nodes) {
    for (const otherId of zone.connections) {
      if (!adjacency.has(zone.id)) adjacency.set(zone.id, new Set());
      if (!adjacency.has(otherId)) adjacency.set(otherId, new Set());
      adjacency.get(zone.id)!.add(otherId);
      adjacency.get(otherId)!.add(zone.id);
    }
  }

  const distances = new Map<string, number>([[fromZoneId, 0]]);
  const queue = [fromZoneId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const dist = distances.get(current)!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, dist + 1);
        queue.push(neighbor);
      }
    }
  }
  return distances;
}
