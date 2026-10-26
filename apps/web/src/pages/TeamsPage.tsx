import { Link } from "react-router";
import { useCurrentUser } from "../hooks/useAuth";
import { useDeleteTeam, useTeams } from "../hooks/useTeams";

export function TeamsPage() {
  const { data: user } = useCurrentUser();
  const { data: teams, isPending, isError, error } = useTeams();
  const deleteTeam = useDeleteTeam();

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) return <p className="status">Couldn't load your teams: {error.message}</p>;

  return (
    <main>
      <div className="page-header">
        <h1>My teams</h1>
        <Link to="/teams/new" className="button">New team</Link>
      </div>
      <p className="muted">Logged in as {user?.displayName}</p>

      {deleteTeam.isError && (
        <p className="form-error" role="alert">
          Couldn't delete the team: {deleteTeam.error.message}
        </p>
      )}

      {teams.length === 0 ? (
        <p className="muted">You don't have any teams yet. Create your first one!</p>
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
              <div className="team-actions">
                <Link to={`/teams/${team.id}`}>Edit</Link>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (window.confirm(`Delete "${team.name}"?`)) deleteTeam.mutate(team.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}