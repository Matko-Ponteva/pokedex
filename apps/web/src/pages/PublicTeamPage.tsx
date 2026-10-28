import { Link, useParams } from "react-router";
import { TypeBadge } from "../components/TypeBadge";
import { TeamAnalysis } from "../components/TeamAnalysis";
import { usePublicTeam } from "../hooks/useTeams";
import { formatMove, formatPokemonName } from "../lib/format";

export function PublicTeamPage() {
  const { shareId = "" } = useParams();
  const { data: team, isPending, isError } = usePublicTeam(shareId);

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) {
    return (
      <main className="status">
        <p>This team doesn't exist, or it isn't public.</p>
        <Link to="/">Go to the Pokédex</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>{team.name}</h1>
      <p className="muted">A team by {team.ownerName}</p>

      <ol className="member-list public-members">
        {team.members.map((member) => (
          <li key={member.slot} className="member-card">
            <Link to={`/pokemon/${member.pokemon.id}`} className="member-header">
              <img src={member.pokemon.spriteUrl} alt="" width={72} height={72} />
              <div>
                <span className="number">Slot {member.slot}</span>
                <h3>{formatPokemonName(member.pokemon.name)}</h3>
                <div className="card-types">
                  {member.pokemon.types.map((type) => (
                    <TypeBadge key={type} type={type} />
                  ))}
                </div>
              </div>
            </Link>
            {member.moves.length > 0 && (
              <ul className="move-list">
                {member.moves.map((move) => (
                  <li key={move}>{formatMove(move)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      <TeamAnalysis
        members={team.members.map((member) => ({
          key: String(member.slot),
          pokemon: member.pokemon,
          moves: member.moves,
        }))}
      />
    </main>
  );
}