import { isMainSeries } from "../api/pokemon";
import { usePokemonIndex, useTypePokemon } from "../hooks/usePokemonList";
import { PokemonGrid } from "./PokemonGrid";

type Props = { search: string; type: string | null };

export function FilteredGrid({ search, type }: Props) {
  const index = usePokemonIndex();
  const typeMembers = useTypePokemon(type);

  if (index.isPending || (type && typeMembers.isPending)) {
    return <p className="status">Loading…</p>;
  }
  if (index.isError || typeMembers.isError) {
    return <p className="status">Couldn't load Pokémon. Check your connection and try again.</p>;
  }

  const query = search.trim().toLowerCase();
  const items = index.data.results.filter(
    (p) =>
      isMainSeries(p) &&
      p.name.includes(query) &&
      (!typeMembers.data || typeMembers.data.has(p.name))
  );

  if (items.length === 0) return <p className="status">No Pokémon match these filters.</p>;
  return <PokemonGrid items={items} />;
}