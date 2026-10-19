import { useQuery } from "@tanstack/react-query";
import { fetchJson, fetchPokemon, type EvolutionChain, type PokemonSpecies } from "../api/pokemon";

export function usePokemon(id: string) {
  return useQuery({
    queryKey: ["pokemon", "detail", id],
    queryFn: () => fetchPokemon(id),
  });
}

export function usePokemonSpecies(url: string | undefined) {
  return useQuery({
    queryKey: ["species", url],
    queryFn: () => fetchJson<PokemonSpecies>(url!),
    enabled: !!url,
  });
}

export function useEvolutionChain(url: string | undefined) {
  return useQuery({
    queryKey: ["evolution-chain", url],
    queryFn: () => fetchJson<EvolutionChain>(url!),
    enabled: !!url,
  });
}