import { isMainSeries } from "../api/pokemon";
import { usePokemonPages } from "../hooks/usePokemonList";
import { useOnVisible } from "../hooks/useOnVisible";
import { PokemonGrid } from "./PokemonGrid";

export function BrowseGrid() {
  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePokemonPages();
  const sentinelRef = useOnVisible(fetchNextPage, hasNextPage && !isFetchingNextPage);

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) return <p className="status">Couldn't load Pokémon: {error.message}</p>;

  const items = data.pages.flatMap((page) => page.results).filter(isMainSeries);

  return (
    <>
      <PokemonGrid items={items} />
      <div ref={sentinelRef} className="status">
        {isFetchingNextPage ? "Loading more…" : hasNextPage ? "" : "You've seen them all."}
      </div>
    </>
  );
}