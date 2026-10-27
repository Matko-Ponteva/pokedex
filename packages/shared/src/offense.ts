import { POKEMON_TYPES, type PokemonType } from "./pokemonTypes.ts";
import { effectivenessAgainst } from "./typeChart.ts";

export type MoveCategory = "physical" | "special" | "status";

export type MoveInfo = {
  name: string;
  type: PokemonType;
  category: MoveCategory;
  power: number | null;
};

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

export function damageMultiplier(
  move: MoveInfo,
  attackerTypes: readonly PokemonType[],
  defendTypes: readonly PokemonType[]
): number {
  const stab = attackerTypes.includes(move.type) ? STAB_BONUS : 1;
  return effectivenessAgainst(move.type, defendTypes) * stab;
}

export function analyzeCoverage(
  team: readonly Attacker[],
  targets: readonly CoverageTarget[]
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
      const multiplier = damageMultiplier(move, attackerTypes, target.types);
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