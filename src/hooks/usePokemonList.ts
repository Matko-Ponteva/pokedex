import { useQuery } from "@tanstack/react-query";
import { fetchPokemonList } from "../api/pokemon";

export function usePokemonList() {
    return useQuery({
        queryKey: ["pokemon", "list"],
        queryFn: () => fetchPokemonList(151),
    });
}
