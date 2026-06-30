/** Total XP required to *reach* a given level. Level 1 starts at 0 XP. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(25 * Math.pow(level - 1, 1.7));
}

/** The level a player is at for a given total XP. */
export function levelForXp(xp: number): number {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

export interface LevelProgress {
  level: number;
  /** XP earned into the current level. */
  into: number;
  /** XP span of the current level. */
  need: number;
  /** 0..1 progress toward the next level. */
  pct: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = xp - cur;
  const need = next - cur;
  return { level, into, need, pct: need > 0 ? into / need : 1 };
}
