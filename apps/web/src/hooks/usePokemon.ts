import { useQuery } from "@tanstack/react-query";
import { fetchPokemon } from "../api/pokemon";

export function usePokemon(id: string) {
  return useQuery({
    queryKey: ["pokemon", "detail", id],
    queryFn: () => fetchPokemon(id),
  });
}