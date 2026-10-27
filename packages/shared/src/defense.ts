import { POKEMON_TYPES, type PokemonType } from "./pokemonTypes.ts";
import { effectivenessAgainst } from "./typeChart.ts";

export type DefensiveMatchup = {
  attackType: PokemonType;
  multipliers: number[];
  weak: number;
  resistant: number;
  immune: number;
};

export function analyzeDefense(team: readonly (readonly PokemonType[])[]): DefensiveMatchup[] {
  return POKEMON_TYPES.map((attackType) => {
    const multipliers = team.map((types) => effectivenessAgainst(attackType, types));
    return {
      attackType,
      multipliers,
      weak: multipliers.filter((m) => m > 1).length,
      resistant: multipliers.filter((m) => m > 0 && m < 1).length,
      immune: multipliers.filter((m) => m === 0).length,
    };
  });
}

export function sharedWeaknesses(matchups: readonly DefensiveMatchup[]): PokemonType[] {
  return matchups
    .filter((m) => m.weak >= 2 && m.weak > m.resistant + m.immune)
    .map((m) => m.attackType);
}