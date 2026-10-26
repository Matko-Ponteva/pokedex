import { HttpError } from "./errors.ts";
import { POKEMON_TYPES, type EvolutionStage, type PokemonDetail, type PokemonSummary, type PokemonType } from "@pokedex/shared";

const BASE_URL = "https://pokeapi.co/api/v2";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const MAX_SPECIES_ID = 10000;

// PokéAPI's shapes (only the fields we use)
type NamedResource = { name: string; url: string };
type RawList = { results: NamedResource[] };
type RawType = { pokemon: { slot: number; pokemon: NamedResource }[] };
type RawPokemon = {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { slot: number; type: NamedResource }[];
  stats: { base_stat: number; stat: NamedResource }[];
  abilities: { is_hidden: boolean; ability: NamedResource }[];
  species: NamedResource;
  moves: { move: NamedResource }[];
};
type RawSpecies = {
  evolution_chain: { url: string } | null;
  flavor_text_entries: { flavor_text: string; language: NamedResource }[];
};
type RawChainLink = { species: NamedResource; evolves_to: RawChainLink[] };
type RawEvolutionChain = { chain: RawChainLink };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 404) throw new HttpError(404, "Pokémon not found");
  if (!res.ok) throw new HttpError(502, `PokéAPI responded with ${res.status}`);
  return (await res.json()) as T;
}

function idFromUrl(url: string): number {
  const parts = url.split("/").filter(Boolean);
  return Number(parts[parts.length - 1]);
}

const spriteUrl = (id: number) => `${SPRITE_BASE}/${id}.png`;
const artworkUrl = (id: number) => `${SPRITE_BASE}/other/official-artwork/${id}.png`;

export async function fetchPokemonIndex(): Promise<PokemonSummary[]> {
  const [list, typeLists] = await Promise.all([
    fetchJson<RawList>(`${BASE_URL}/pokemon?limit=2000`),
    Promise.all(POKEMON_TYPES.map((type) => fetchJson<RawType>(`${BASE_URL}/type/${type}`))),
  ]);

  // Build a name → types map, keeping the primary type (slot 1) first
  const typesByName = new Map<string, PokemonType[]>();
  typeLists.forEach((typeData, i) => {
    for (const entry of typeData.pokemon) {
      const types = typesByName.get(entry.pokemon.name) ?? [];
      types[entry.slot - 1] = POKEMON_TYPES[i];
      typesByName.set(entry.pokemon.name, types);
    }
  });

  return list.results
    .map((item) => ({ id: idFromUrl(item.url), name: item.name }))
    .filter((p) => p.id < MAX_SPECIES_ID)
    .map((p) => ({
      ...p,
      types: (typesByName.get(p.name) ?? []).filter(Boolean),
      spriteUrl: spriteUrl(p.id),
    }));
}

export async function fetchPokemonDetail(id: number): Promise<PokemonDetail> {
  const pokemon = await fetchJson<RawPokemon>(`${BASE_URL}/pokemon/${id}`);
  const species = await fetchJson<RawSpecies>(pokemon.species.url);

  let evolution: EvolutionStage[] = [];
  if (species.evolution_chain) {
    const chain = await fetchJson<RawEvolutionChain>(species.evolution_chain.url);
    evolution = toStages(chain.chain);
    
  }

  const flavor = species.flavor_text_entries.find((e) => e.language.name === "en");

  return {
    id: pokemon.id,
    name: pokemon.name,
    types: pokemon.types.map((t) => t.type.name as PokemonType),
    heightMeters: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    description: flavor ? flavor.flavor_text.replace(/[\f\n]/g, " ") : null,
    artworkUrl: artworkUrl(pokemon.id),
    stats: pokemon.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    abilities: pokemon.abilities.map((a) => ({
      name: a.ability.name.replaceAll("-", " "),
      hidden: a.is_hidden,
    })),
    evolution,
    moves: pokemon.moves.map((m) => m.move.name).sort(),
  };
}

function toStages(root: RawChainLink): EvolutionStage[] {
  const stages: EvolutionStage[] = [];
  let current = [root];
  while (current.length > 0) {
    stages.push(
      current.map((link) => {
        const id = idFromUrl(link.species.url);
        return { id, name: link.species.name, spriteUrl: spriteUrl(id) };
      })
    );
    current = current.flatMap((link) => link.evolves_to);
  }
  return stages;
}