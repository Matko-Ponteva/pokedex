const BASE_URL = "https://pokeapi.co/api/v2";

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

type NamedResource = { name: string; url: string };

// List
export type PokemonListItem = NamedResource;
export type PokemonListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: PokemonListItem[];
};

export function fetchPokemonList(limit = 151) {
  return fetchJson<PokemonListResponse>(`${BASE_URL}/pokemon?limit=${limit}`);
}

// Detail
export type Pokemon = {
  id: number;
  name: string;
  height: number; // decimetres
  weight: number; // hectograms
  types: { slot: number; type: NamedResource }[];
  stats: { base_stat: number; stat: NamedResource }[];
  abilities: { is_hidden: boolean; ability: NamedResource }[];
  species: NamedResource;
};

export type PokemonSpecies = {
  evolution_chain: { url: string };
  flavor_text_entries: { flavor_text: string; language: NamedResource }[];
};

export type ChainLink = { species: NamedResource; evolves_to: ChainLink[] };
export type EvolutionChain = { chain: ChainLink };

export function fetchPokemon(id: string) {
  return fetchJson<Pokemon>(`${BASE_URL}/pokemon/${id}`);
}

// Helpers
export function getIdFromUrl(url: string): number {
  const parts = url.split("/").filter(Boolean);
  return Number(parts[parts.length - 1]);
}

export function getSpriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export function getArtworkUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

export const PAGE_SIZE = 24;
const MAX_SPECIES_ID = 10000;

export function fetchPokemonPage(offset: number) {
  return fetchJson<PokemonListResponse>(
    `${BASE_URL}/pokemon?limit=${PAGE_SIZE}&offset=${offset}`
  );
}

export type TypeResponse = {
  pokemon: { slot: number; pokemon: NamedResource }[];
};

export function fetchType(type: string) {
  return fetchJson<TypeResponse>(`${BASE_URL}/type/${type}`);
}

export function isMainSeries(item: PokemonListItem): boolean {
  return getIdFromUrl(item.url) < MAX_SPECIES_ID;
}