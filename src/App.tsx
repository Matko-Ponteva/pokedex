import { useState } from "react";
import { usePokemonList } from "./hooks/usePokemonList";
import { PokemonCard } from "./components/PokemonCard";

export default function App() {
  const { data, isPending, isError, error } = usePokemonList();
  const [search, setSearch] = useState("");

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) return <p className="status">Couldn't load Pokémon: {error.message}</p>;

  const query = search.trim().toLowerCase();
  const filtered = data.results.filter((p) => p.name.includes(query));

  return (
    <main>
      <h1>Pokédex</h1>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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