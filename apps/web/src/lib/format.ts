export function formatMove(move: string): string {
  return move
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const formatPokemonName = formatMove;