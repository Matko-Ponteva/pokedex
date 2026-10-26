import { Navigate, Outlet, useLocation } from "react-router";
import { useCurrentUser } from "../hooks/useAuth";

export function RequireAuth() {
  const { data: user, isPending, isError } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <p className="status">Loading…</p>;
  if (isError) return <p className="status">Couldn't check whether you're logged in. Try again later.</p>;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}