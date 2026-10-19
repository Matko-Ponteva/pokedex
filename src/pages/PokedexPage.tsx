import { useSearchParams } from "react-router";
import { usePokemonList } from "../hooks/usePokemonList";
import { PokemonCard } from "../components/PokemonCard";

export function PokedexPage() {
  const { data, isPending, isError, error } = usePokemonList();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) return <p className="status">Couldn't load Pokémon: {error.message}</p>;

  const query = search.trim().toLowerCase();
  const filtered = data.results.filter((p) => p.name.includes(query));

  return (
    <main>
      <h1>Pokédex</h1>
      <input
        value={search}
        onChange={(e) =>
          setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
        }
        placeholder="Search Pokémon"
      />
      <ul className="grid">
        {filtered.map((p) => (
          <PokemonCard key={p.name} pokemon={p} />
        ))}
      </ul>
    </main>
  );
}