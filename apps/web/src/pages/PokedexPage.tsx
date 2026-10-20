import { useSearchParams } from "react-router";
import { TypeFilter } from "../components/TypeFilter";
import { BrowseGrid } from "../components/BrowseGrid";
import { FilteredGrid } from "../components/FilteredGrid";

export function PokedexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const type = searchParams.get("type");

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

  const isFiltering = search.trim() !== "" || type !== null;

  return (
    <main>
      <h1>Pokédex</h1>
      <input
        value={search}
        onChange={(e) => updateParam("q", e.target.value)}
        placeholder="Search Pokémon"
      />
      <TypeFilter selected={type} onSelect={(t) => updateParam("type", t)} />
      {isFiltering ? <FilteredGrid search={search} type={type} /> : <BrowseGrid />}
    </main>
  );
}