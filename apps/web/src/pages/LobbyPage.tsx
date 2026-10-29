import { useCurrentUser } from "../hooks/useAuth";
import { useOnlineUsers, useSocketConnected } from "../realtime/useSocket";

export function LobbyPage() {
  const { data: me } = useCurrentUser();
  const connected = useSocketConnected();
  const users = useOnlineUsers();

  return (
    <main>
      <div className="page-header">
        <h1>Lobby</h1>
        <span className={connected ? "status-dot online" : "status-dot"}>
          {connected ? "Connected" : "Connecting…"}
        </span>
      </div>
      <p className="muted">
        Trainers who have the app open right now. Trading and battles arrive in the next parts.
      </p>

      {users === null ? (
        <p className="status">Loading…</p>
      ) : (
        <ul className="online-list">
          {users.map((user) => (
            <li key={user.id}>
              <span className="status-dot online" aria-hidden="true" />
              {user.displayName}
              {user.id === me?.id && <span className="muted"> (you)</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}