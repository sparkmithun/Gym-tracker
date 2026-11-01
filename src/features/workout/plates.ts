/** Plates per side to load `target` on a bar of `bar` weight. Greedy works for standard plate sets. */
export function platesPerSide(target: number, bar: number, available: number[]): { plates: number[]; remainder: number } {
  let perSide = (target - bar) / 2;
  if (perSide <= 0) return { plates: [], remainder: Math.max(0, target - bar) };
  const plates: number[] = [];
  for (const p of [...available].sort((a, b) => b - a)) {
    while (perSide >= p - 1e-9) {
      plates.push(p);
      perSide -= p;
    }
  }
  return { plates, remainder: Math.round(perSide * 2 * 100) / 100 };
}

export const PLATE_SETS = {
  kg: { bars: [20, 15, 10], plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lbs: { bars: [45, 35, 25], plates: [45, 35, 25, 10, 5, 2.5] },
} as const;
