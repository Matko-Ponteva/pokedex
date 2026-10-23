export const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export function isPokemonType(value: unknown): value is PokemonType {
  return typeof value === "string" && (POKEMON_TYPES as readonly string[]).includes(value);
}

export const DEFAULT_PAGE_SIZE = 24;

export type PokemonSummary = {
  id: number;
  name: string;
  types: PokemonType[];
  spriteUrl: string;
};

export type PokemonListResponse = {
  items: PokemonSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type EvolutionStage = { id: number; name: string; spriteUrl: string }[];

export type PokemonDetail = {
  id: number;
  name: string;
  types: PokemonType[];
  heightMeters: number;
  weightKg: number;
  description: string | null;
  artworkUrl: string;
  stats: { name: string; value: number }[];
  abilities: { name: string; hidden: boolean }[];
  evolution: EvolutionStage[];
};

export type ApiError = {
  error: string;
  details?: { field: string; message: string }[];
};