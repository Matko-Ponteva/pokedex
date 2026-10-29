import { Link, NavLink, Outlet } from "react-router";
import { useCurrentUser, useLogOut } from "../hooks/useAuth";
import { useSocketConnection } from "../realtime/useSocket";

export function AppLayout() {
  useSocketConnection();
  const { data: user } = useCurrentUser();
  const logOut = useLogOut();

  return (
    <>
      <header className="app-header">
        <nav className="app-nav">
          <NavLink to="/" end>Pokédex</NavLink>
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/teams">My teams</NavLink>
          <NavLink to="/lobby">Lobby</NavLink>
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