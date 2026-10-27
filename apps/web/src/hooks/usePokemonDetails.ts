import { useQueries } from "@tanstack/react-query";
import { fetchPokemon } from "../api/pokemon";

export function usePokemonDetails(ids: number[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ["pokemon", "detail", String(id)],
      queryFn: () => fetchPokemon(String(id)),
    })),
  });
}