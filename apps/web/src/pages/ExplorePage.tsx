import { useSearchParams } from "react-router";
import { isPublicTeamSort, type PublicTeamSort } from "@pokedex/shared";
import { PublicTeamCard } from "../components/PublicTeamCard";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useOnVisible } from "../hooks/useOnVisible";
import { usePublicTeams } from "../hooks/useTeams";

const SORT_LABELS: Record<PublicTeamSort, string> = {
  newest: "Newest",
  name: "Name (A to Z)",
};

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const sortParam = searchParams.get("sort");
  const sort: PublicTeamSort = isPublicTeamSort(sortParam) ? sortParam : "newest";
  const debouncedSearch = useDebouncedValue(search.trim());

  const {
    data, isPending, isError, error,
    fetchNextPage, hasNextPage, isFetchingNextPage, isPlaceholderData,
  } = usePublicTeams(debouncedSearch, sort);
  const sentinelRef = useOnVisible(
    fetchNextPage,
    hasNextPage && !isFetchingNextPage && !isPlaceholderData
  );

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

  function renderResults() {
    if (isPending) return <p className="status">Loading…</p>;
    if (isError) return <p className="status">Couldn't load teams: {error.message}</p>;

    const teams = data.pages.flatMap((page) => page.items);
    if (teams.length === 0) return <p className="status">No public teams match your search.</p>;

    return (
      <div className={isPlaceholderData ? "stale" : undefined}>
        <ul className="team-list">
          {teams.map((team) => (
            <PublicTeamCard key={team.shareId} team={team} />
          ))}
        </ul>
        <div ref={sentinelRef} className="status">
          {isFetchingNextPage ? "Loading more…" : hasNextPage ? "" : "That's every public team."}
        </div>
      </div>
    );
  }

  return (
    <main>
      <h1>Explore teams</h1>
      <div className="explore-controls">
        <input
          value={search}
          onChange={(e) => updateParam("q", e.target.value)}
          placeholder="Search by team or trainer name"
          aria-label="Search teams"
        />
        <label className="sort-select">
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value === "newest" ? null : e.target.value)}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {renderResults()}
    </main>
  );
}