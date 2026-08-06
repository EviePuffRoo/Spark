// Most tables are one entry per face, but a hand-edited entry could use a
// range like "3-5" instead of a single value - weight rolls accordingly so a
// quick-roll still reflects real odds either way.
function rollWeight(roll: string): number {
  const match = roll.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (!match) return 1;
  const lo = Number(match[1]);
  const hi = Number(match[2]);
  return Math.max(1, hi - lo + 1);
}

export function rollTableIndex(entries: { roll: string }[]): number {
  const weights = entries.map((e) => rollWeight(e.roll));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return entries.length - 1;
}
