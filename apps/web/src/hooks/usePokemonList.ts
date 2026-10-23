import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { PokemonType } from "@pokedex/shared";
import { fetchPokemonPage } from "../api/pokemon";

export function usePokemonPages(search: string, type: PokemonType | null) {
  return useInfiniteQuery({
    queryKey: ["pokemon", "list", { search, type }],
    queryFn: ({ pageParam }) => fetchPokemonPage({ search, type, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}