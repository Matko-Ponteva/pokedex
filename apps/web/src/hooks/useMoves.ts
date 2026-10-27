import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchMoves } from "../api/moves";

export function useMoves(names: string[]) {
  const sorted = [...new Set(names)].sort();
  return useQuery({
    queryKey: ["moves", sorted],
    queryFn: () => fetchMoves(sorted),
    enabled: sorted.length > 0,
    placeholderData: keepPreviousData,
    select: (moves) => new Map(moves.map((move) => [move.name, move])),
  });
}