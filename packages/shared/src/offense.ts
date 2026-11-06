import { POKEMON_TYPES, type PokemonType } from "./pokemonTypes.ts";
import { effectivenessAgainst } from "./typeChart.ts";

export type MoveCategory = "physical" | "special" | "status";

export const STATUS_CONDITIONS = ["burn", "poison", "paralysis", "sleep", "freeze"] as const;
export type StatusCondition = (typeof STATUS_CONDITIONS)[number];

export function isStatusCondition(value: unknown): value is StatusCondition {
  return typeof value === "string" && (STATUS_CONDITIONS as readonly string[]).includes(value);
}

export type MoveInfo = {
  name: string;
  type: PokemonType;
  category: MoveCategory;
  power: number | null;
  /** Percent chance to hit; null or missing means the move never misses */
  accuracy?: number | null;
  /** Major status the move can inflict on the target */
  ailment?: StatusCondition | null;
  /** Percent chance to inflict the ailment; 0 means it always does */
  ailmentChance?: number;
  /** 0 for normal moves, 1 or more for high critical-hit moves */
  critRate?: number;
  /** Stat stages the move changes, e.g. Swords Dance: attack +2 */
  statChanges?: StatChange[];
  /** Whose stats change: the user's (Dragon Dance, Flame Charge) or the target's (Scary Face, Crunch) */
  statTarget?: "user" | "target";
  /** Percent chance of the stat change for damaging moves; 0 means it always happens */
  statChance?: number;
  /** Percent of max HP restored by healing moves like Recover */
  healing?: number;
  /** Percent of damage dealt the user regains (Giga Drain), or loses as recoil when negative */
  drain?: number;
  /** Moves with higher priority go first regardless of speed: Protect is +4, Quick Attack +1, Counter -5 */
  priority?: number;
  /** Base PP; missing means the move never runs out */
  pp?: number | null;
  /** An effect other than a major status the move can cause, like "confusion", "trap" or "yawn" (PokéAPI's ailment) */
  volatile?: string | null;
  /** Percent chance a damaging move makes the target flinch */
  flinchChance?: number;
  /** How many times a multi-hit move hits (Double Kick: 2–2, Bullet Seed: 2–5); missing means once */
  minHits?: number | null;
  maxHits?: number | null;
  /** Who the move aims at (PokéAPI's move target), which matters in double battles; see targets.ts */
  target?: string | null;
};

export const BOOST_STATS = ["attack", "defense", "special-attack", "special-defense", "speed", "accuracy", "evasion"] as const;
export type BoostStat = (typeof BOOST_STATS)[number];

export function isBoostStat(value: unknown): value is BoostStat {
  return typeof value === "string" && (BOOST_STATS as readonly string[]).includes(value);
}

export type StatChange = { stat: BoostStat; change: number };

export type Attacker = {
  types: readonly PokemonType[];
  moves: readonly MoveInfo[];
};

export type CoverageTarget = {
  types: PokemonType[];
  count: number;
};

export type CoverageEntry = CoverageTarget & {
  best: number;
  bestMoves: string[];
};

export type CoverageSummary = {
  total: number;
  superEffective: number;
  neutralOrBetter: number;
};

export const STAB_BONUS = 1.5;

export const SINGLE_TYPE_TARGETS: CoverageTarget[] = POKEMON_TYPES.map((type) => ({
  types: [type],
  count: 1,
}));

export type CoverageOptions = {
  /** Apply the STAB bonus for moves that match their user's type (default true) */
  stab?: boolean;
};

export function damageMultiplier(
  move: MoveInfo,
  attackerTypes: readonly PokemonType[],
  defendTypes: readonly PokemonType[],
  { stab = true }: CoverageOptions = {}
): number {
  const bonus = stab && attackerTypes.includes(move.type) ? STAB_BONUS : 1;
  return effectivenessAgainst(move.type, defendTypes) * bonus;
}

export function analyzeCoverage(
  team: readonly Attacker[],
  targets: readonly CoverageTarget[],
  options: CoverageOptions = {}
): CoverageEntry[] {
  const attacks = team.flatMap((member) =>
    member.moves
      .filter((move) => move.category !== "status")
      .map((move) => ({ move, attackerTypes: member.types }))
  );

  return targets.map((target) => {
    let best = 0;
    let bestMoves: string[] = [];
    for (const { move, attackerTypes } of attacks) {
      const multiplier = damageMultiplier(move, attackerTypes, target.types, options);
      if (multiplier > best) {
        best = multiplier;
        bestMoves = [move.name];
      } else if (multiplier === best && multiplier > 0 && !bestMoves.includes(move.name)) {
        bestMoves.push(move.name);
      }
    }
    return { ...target, best, bestMoves };
  });
}

export function coverageGaps(coverage: readonly CoverageEntry[]): CoverageEntry[] {
  return coverage.filter((entry) => entry.best < 1);
}

export function summarizeCoverage(coverage: readonly CoverageEntry[]): CoverageSummary {
  let total = 0;
  let superEffective = 0;
  let neutralOrBetter = 0;
  for (const entry of coverage) {
    total += entry.count;
    if (entry.best >= 2) superEffective += entry.count;
    if (entry.best >= 1) neutralOrBetter += entry.count;
  }
  return { total, superEffective, neutralOrBetter };
}

export type DistributionBucket = {
  multiplier: number;
  count: number;
};

export function coverageDistribution(coverage: readonly CoverageEntry[]): DistributionBucket[] {
  const counts = new Map<number, number>();
  for (const entry of coverage) {
    counts.set(entry.best, (counts.get(entry.best) ?? 0) + entry.count);
  }
  return [...counts.entries()]
    .map(([multiplier, count]) => ({ multiplier, count }))
    .sort((a, b) => a.multiplier - b.multiplier);
}