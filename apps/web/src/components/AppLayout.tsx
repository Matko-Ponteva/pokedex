import { Link, NavLink, Outlet } from "react-router";
import { useCurrentUser, useLogOut } from "../hooks/useAuth";

export function AppLayout() {
  const { data: user } = useCurrentUser();
  const logOut = useLogOut();

  return (
    <>
      <header className="app-header">
        <nav className="app-nav">
          <NavLink to="/" end>Pokédex</NavLink>
          <NavLink to="/teams">My teams</NavLink>
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