import type { PokemonType } from "@pokedex/shared";
import { usePokemonPages } from "../hooks/usePokemonList";
import { useOnVisible } from "../hooks/useOnVisible";
import { PokemonGrid } from "./PokemonGrid";

type Props = { search: string; type: PokemonType | null };

export function PokemonResults({ search, type }: Props) {
  const {
    data, isPending, isError, error,
    fetchNextPage, hasNextPage, isFetchingNextPage, isPlaceholderData,
  } = usePokemonPages(search, type);
  const sentinelRef = useOnVisible(
    fetchNextPage,
    hasNextPage && !isFetchingNextPage && !isPlaceholderData
  );

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) return <p className="status">Couldn't load Pokémon: {error.message}</p>;

  const items = data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <p className="status">No Pokémon match these filters.</p>;

  return (
    <div className={isPlaceholderData ? "stale" : undefined}>
      <p className="muted">{data.pages[0].total} Pokémon</p>
      <PokemonGrid items={items} />
      <div ref={sentinelRef} className="status">
        {isFetchingNextPage ? "Loading more…" : hasNextPage ? "" : "You've seen them all."}
      </div>
    </div>
  );
}