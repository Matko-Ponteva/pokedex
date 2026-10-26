import { Link, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { PokedexPage } from "./pages/PokedexPage";
import { PokemonDetailPage } from "./pages/PokemonDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { TeamsPage } from "./pages/TeamsPage";

function NotFoundPage() {
  return (
    <main className="status">
      <h1>Page not found</h1>
      <Link to="/">Go to the Pokédex</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<PokedexPage />} />
        <Route path="/pokemon/:id" element={<PokemonDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/teams" element={<TeamsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}