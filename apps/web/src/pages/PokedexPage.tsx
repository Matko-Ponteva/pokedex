import { useSearchParams } from "react-router";
import { isPokemonType } from "@pokedex/shared";
import { TypeFilter } from "../components/TypeFilter";
import { PokemonResults } from "../components/PokemonResults";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

function toSearchTerm(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function PokedexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const typeParam = searchParams.get("type");
  const type = isPokemonType(typeParam) ? typeParam : null;
  const debouncedSearch = useDebouncedValue(search);

  function updateParam(key: string, value: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }

  return (
    <main>
      <h1>Pokédex</h1>
      <input
        value={search}
        onChange={(e) => updateParam("q", e.target.value)}
        placeholder="Search Pokémon"
      />
      <TypeFilter selected={type} onSelect={(t) => updateParam("type", t)} />
      <PokemonResults search={toSearchTerm(debouncedSearch)} type={type} />
    </main>
  );
}