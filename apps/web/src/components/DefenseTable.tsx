import { analyzeDefense, sharedWeaknesses, type PokemonSummary } from "@pokedex/shared";
import { TypeBadge } from "./TypeBadge";

const LABELS = new Map([[0, "0"], [0.25, "¼"], [0.5, "½"], [2, "2"], [4, "4"]]);

function cellClass(multiplier: number): string | undefined {
  if (multiplier === 0) return "immune";
  if (multiplier < 1) return "resist";
  if (multiplier > 2) return "very-weak";
  if (multiplier > 1) return "weak";
  return undefined;
}

export function DefenseTable({ members }: { members: PokemonSummary[] }) {
  if (members.length === 0) return null;

  const matchups = analyzeDefense(members.map((p) => p.types));
  const threats = sharedWeaknesses(matchups);

  return (
    <section className="analysis">
      <h2>Defensive matchups</h2>
      <p className="muted">
        How much damage each attacking type deals to each member. Marked rows are weaknesses
        shared by several members.
      </p>
      {threats.length > 0 && (
        <div className="threat-summary">
          <span>Shared weaknesses:</span>
          {threats.map((type) => (
            <TypeBadge key={type} type={type} />
          ))}
        </div>
      )}
      <div className="table-scroll">
        <table className="defense-table">
          <thead>
            <tr>
              <th scope="col">Attack</th>
              {members.map((p, i) => (
                <th key={i} scope="col">
                  <img src={p.spriteUrl} alt={p.name} title={p.name} width={40} height={40} />
                </th>
              ))}
              <th scope="col">Weak</th>
              <th scope="col">Resist</th>
            </tr>
          </thead>
          <tbody>
            {matchups.map((m) => (
              <tr key={m.attackType} className={threats.includes(m.attackType) ? "threat" : undefined}>
                <th scope="row">
                  <TypeBadge type={m.attackType} />
                </th>
                {m.multipliers.map((value, i) => (
                  <td key={i} className={cellClass(value)}>
                    {LABELS.get(value) ?? ""}
                  </td>
                ))}
                <td className="count">{m.weak || ""}</td>
                <td className="count">{m.resistant + m.immune || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}