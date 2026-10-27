import {
  SINGLE_TYPE_TARGETS, analyzeCoverage, coverageGaps, summarizeCoverage,
  type Attacker, type CoverageTarget,
} from "@pokedex/shared";
import { TypeBadge } from "./TypeBadge";
import { formatMove } from "../lib/format";

type Props = {
  team: Attacker[];
  combinations: CoverageTarget[] | undefined;
};

function coverageClass(best: number): string {
  if (best >= 2) return "strong";
  if (best < 1) return "poor";
  return "neutral";
}

function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function CoverageGrid({ team, combinations }: Props) {
  const hasDamagingMoves = team.some((member) =>
    member.moves.some((move) => move.category !== "status")
  );

  if (!hasDamagingMoves) {
    return (
      <section className="analysis">
        <h2>Offensive coverage</h2>
        <p className="muted">Choose some damaging moves to see which types your team hits hard.</p>
      </section>
    );
  }

  const singleTypes = analyzeCoverage(team, SINGLE_TYPE_TARGETS);
  const allPokemon = combinations ? analyzeCoverage(team, combinations) : [];
  const summary = summarizeCoverage(allPokemon);
  const hardest = coverageGaps(allPokemon).slice(0, 10);

  return (
    <section className="analysis">
      <h2>Offensive coverage</h2>
      <p className="muted">
        Multipliers include the 1.5× STAB bonus for moves that match their user's type. Status
        moves don't count.
      </p>

      {summary.total > 0 && (
        <p className="coverage-summary">
          Against all {summary.total} Pokémon, your moves hit{" "}
          <strong>{percent(summary.superEffective, summary.total)}%</strong> super effectively and{" "}
          <strong>{percent(summary.neutralOrBetter, summary.total)}%</strong> for at least neutral damage.
        </p>
      )}

      <h3>By single type</h3>
      <ul className="coverage-grid">
        {singleTypes.map((entry) => (
          <li key={entry.types.join("/")} className={`coverage-cell ${coverageClass(entry.best)}`}>
            <TypeBadge type={entry.types[0]} />
            <span className="coverage-value">{entry.best}×</span>
            <span className="coverage-moves">{entry.bestMoves.map(formatMove).join(", ")}</span>
          </li>
        ))}
      </ul>

      {hardest.length > 0 && (
        <>
          <h3>Hardest to hit</h3>
          <p className="muted">
            Type combinations that none of your moves hit for neutral damage, most common first.
          </p>
          <ul className="hard-list">
            {hardest.map((entry) => (
              <li key={entry.types.join("/")}>
                <span className="hard-types">
                  {entry.types.map((type) => (
                    <TypeBadge key={type} type={type} />
                  ))}
                </span>
                <span className="muted">
                  {entry.count} Pokémon, best {entry.best}×
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}