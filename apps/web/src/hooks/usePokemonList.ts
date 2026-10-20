import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  fetchPokemonList, fetchPokemonPage, fetchType, isMainSeries, PAGE_SIZE,
} from "../api/pokemon";

export function usePokemonPages() {
  return useInfiniteQuery({
    queryKey: ["pokemon", "pages"],
    queryFn: ({ pageParam }) => fetchPokemonPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const last = lastPage.results.at(-1);
      if (!lastPage.next || !last || !isMainSeries(last)) return undefined;
      return allPages.length * PAGE_SIZE;
    },
  });
}

export function usePokemonIndex() {
  return useQuery({
    queryKey: ["pokemon", "index"],
    queryFn: () => fetchPokemonList(2000),
  });
}

export function useTypePokemon(type: string | null) {
  return useQuery({
    queryKey: ["type", type],
    queryFn: () => fetchType(type!),
    enabled: !!type,
    select: (data) => new Set(data.pokemon.map((entry) => entry.pokemon.name)),
  });
}