import { useState } from "react";
import type { PokemonSummary } from "@pokedex/shared";
import { usePokemonPages } from "../hooks/usePokemonList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { toSearchTerm } from "../lib/search";

type Props = {
  disabled: boolean;
  onPick: (pokemon: PokemonSummary) => void;
};

export function PokemonPicker({ disabled, onPick }: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data, isPending, isError } = usePokemonPages(toSearchTerm(debouncedSearch), null);
  const results = data?.pages[0].items.slice(0, 12) ?? [];

  return (
    <section className="picker">
      <h2>Add a Pokémon</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name"
        aria-label="Search Pokémon to add"
      />
      {disabled && <p className="muted">Your team is full. Remove a Pokémon to add another.</p>}
      {isPending && <p className="muted">Loading…</p>}
      {isError && <p className="field-error">Couldn't load Pokémon.</p>}
      <ul className="picker-results">
        {results.map((p) => (
          <li key={p.id}>
            <button type="button" className="picker-item" disabled={disabled} onClick={() => onPick(p)}>
              <img src={p.spriteUrl} alt="" width={48} height={48} loading="lazy" />
              <span>{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}