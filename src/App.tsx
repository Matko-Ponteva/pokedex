import { Link, Route, Routes } from "react-router";
import { PokedexPage } from "./pages/PokedexPage";
import { PokemonDetailPage } from "./pages/PokemonDetailPage";

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
      <Route path="/" element={<PokedexPage />} />
      <Route path="/pokemon/:id" element={<PokemonDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}