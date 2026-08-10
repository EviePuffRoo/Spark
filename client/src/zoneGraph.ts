interface ConnectedNode {
  id: string;
  connections: string[];
}

// Connections are stored per-zone but treated as symmetric everywhere —
// a link listed from either side counts as adjacency both ways. Generic
// over any {id, connections} shape so it also works for Region.connections
// on the World Map, not just EncounterZone.
export function zoneDistances(zones: ConnectedNode[], fromZoneId: string): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const zone of zones) {
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
