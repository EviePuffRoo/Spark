interface ShuffleBag {
  order: number[];
  cursor: number;
}

const bags = new WeakMap<object, ShuffleBag>();

function shuffledIndices(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function getBag(arr: object, length: number): ShuffleBag {
  const existing = bags.get(arr);
  if (existing && existing.order.length === length) return existing;
  const fresh: ShuffleBag = { order: shuffledIndices(length), cursor: 0 };
  bags.set(arr, fresh);
  return fresh;
}

/**
 * Picks a random element, cycling through every element of `arr` exactly
 * once (in a random order) before any element repeats. Reshuffles only
 * once the cycle is exhausted, so results stay varied across many calls
 * instead of drifting into frequent repeats on small pools.
 */
export function pick<T>(arr: T[]): T {
  if (arr.length === 1) return arr[0];
  const bag = getBag(arr as unknown as object, arr.length);
  if (bag.cursor >= bag.order.length) {
    bag.order = shuffledIndices(arr.length);
    bag.cursor = 0;
  }
  return arr[bag.order[bag.cursor++]];
}

/**
 * Draws `count` distinct elements from `arr` (capped at arr.length),
 * sharing the same underlying shuffle bag as `pick`, so a single call
 * never repeats an element and the bag's cycle position carries over
 * to the next call on the same array.
 */
export function sampleUnique<T>(arr: T[], count: number): T[] {
  const n = Math.min(count, arr.length);
  const bag = getBag(arr as unknown as object, arr.length);
  if (bag.order.length - bag.cursor < n) {
    bag.order = shuffledIndices(arr.length);
    bag.cursor = 0;
  }
  const slice = bag.order.slice(bag.cursor, bag.cursor + n).map((i) => arr[i]);
  bag.cursor += n;
  return slice;
}

export function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "An" : "A";
}
