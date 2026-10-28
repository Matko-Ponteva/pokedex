import type { Attacker, PokemonSummary } from "@pokedex/shared";
import { useMoves } from "../hooks/useMoves";
import { usePokemonDetails } from "../hooks/usePokemonDetails";
import { useTypeCombinations } from "../hooks/useTypeCombinations";
import { TeamStatsChart } from "./TeamStatsChart";
import { DefenseTable } from "./DefenseTable";
import { CoverageGrid } from "./CoverageGrid";

export type AnalysisMember = {
  key: string;
  pokemon: PokemonSummary;
  moves: string[];
};

export function TeamAnalysis({ members }: { members: AnalysisMember[] }) {
  const { data: moveInfo } = useMoves(members.flatMap((m) => m.moves));
  const { data: combinations } = useTypeCombinations();
  const detailResults = usePokemonDetails(members.map((m) => m.pokemon.id));

  if (members.length === 0) return null;

  const attackers: Attacker[] = members.map((member) => ({
    types: member.pokemon.types,
    moves: member.moves.flatMap((name) => {
      const info = moveInfo?.get(name);
      return info ? [info] : [];
    }),
  }));

  const statMembers = members.flatMap((member, index) => {
    const detail = detailResults[index]?.data;
    return detail ? [{ key: member.key, detail }] : [];
  });

  return (
    <>
      <TeamStatsChart members={statMembers} />
      <DefenseTable members={members.map((m) => m.pokemon)} />
      <CoverageGrid team={attackers} combinations={combinations} />
    </>
  );
}