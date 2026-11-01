/**
 * Mulberry32. Same seed always yields the same stream.
 * @param {number} seed
 * @returns {() => number} floats in [0, 1)
 */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** First value of a seed, handy for locking the generator in tests. */
export function firstRandom(seed) {
  return makeRng(seed)();
}
