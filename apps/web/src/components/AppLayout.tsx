import { Link, NavLink, Outlet } from "react-router";
import { useCurrentUser, useLogOut } from "../hooks/useAuth";
import { useSocketConnection, useSocketConnected } from "../realtime/useSocket";
import { useBattleNavigation, useBattleState } from "../realtime/battleStore";

export function AppLayout() {
  useSocketConnection();
  const connected = useSocketConnected();
  const { data: user } = useCurrentUser();
  useBattleNavigation();
  const { challenges } = useBattleState();
  const waiting = challenges.filter((c) => c.to.id === user?.id).length;
  const logOut = useLogOut();

  return (
    <>
          {user && !connected && (
        <div className="connection-banner" role="status">
          Connecting to the server… Battles resume automatically.
        </div>
      )}
      <header className="app-header">
        <nav className="app-nav">
          <NavLink to="/" end>Pokédex</NavLink>
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/teams">My teams</NavLink>
          <NavLink to="/lobby">
            Lobby
            {waiting > 0 && (
              <span className="nav-count" aria-label={`, ${waiting} pending requests`}>
                {waiting}
              </span>
            )}
          </NavLink>
        </nav>
        <div className="app-user">
          {user ? (
            <>
              <span>{user.displayName}</span>
              <button type="button" onClick={() => logOut.mutate()} disabled={logOut.isPending}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/login">Log in</Link>
          )}
        </div>
      </header>
      <Outlet />
    </>
  );
}