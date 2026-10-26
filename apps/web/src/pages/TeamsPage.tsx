import { useCurrentUser } from "../hooks/useAuth";
import { useTeams } from "../hooks/useTeams";

export function TeamsPage() {
  const { data: user } = useCurrentUser();
  const { data: teams, isPending, isError, error } = useTeams();

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) return <p className="status">Couldn't load your teams: {error.message}</p>;

  return (
    <main>
      <h1>My teams</h1>
      <p className="muted">Logged in as {user?.displayName}</p>
      {teams.length === 0 ? (
        <p className="muted">You don't have any teams yet. The team editor arrives in part 4.</p>
      ) : (
        <ul className="team-list">
          {teams.map((team) => (
            <li key={team.id} className="team-card">
              <h2>{team.name}</h2>
              <div className="team-sprites">
                {team.members.map((member) => (
                  <img
                    key={member.slot}
                    src={member.pokemon.spriteUrl}
                    alt={member.pokemon.name}
                    width={64}
                    height={64}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}