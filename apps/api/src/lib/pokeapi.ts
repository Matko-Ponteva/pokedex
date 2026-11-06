import { HttpError } from "./errors.ts";
import {
  POKEMON_TYPES, LEARN_METHODS, isBoostStat, isStatusCondition, type LearnMethod, type EvolutionStage, type StatChange, type MoveCategory, type MoveInfo,
  type PokemonDetail, type PokemonSummary, type PokemonType,
} from "@pokedex/shared";

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
  moves: { move: NamedResource; version_group_details: { move_learn_method: NamedResource }[] }[];
};
type RawSpecies = {
  name: string;
  gender_rate: number;
  evolution_chain: { url: string } | null;
  flavor_text_entries: { flavor_text: string; language: NamedResource }[];
};
type RawChainLink = { species: NamedResource; evolves_to: RawChainLink[] };
type RawEvolutionChain = { chain: RawChainLink };
type RawMove = {
  name: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
  pp: number | null;
  type: NamedResource;
  damage_class: NamedResource;
  target: NamedResource;
  stat_changes: { change: number; stat: NamedResource }[];
  meta: {
    ailment: NamedResource;
    ailment_chance: number;
    crit_rate: number;
    category: NamedResource;
    stat_chance: number;
    healing: number;
    drain: number;
    flinch_chance: number;
    min_hits: number | null;
    max_hits: number | null;
  } | null;
};

/** Move targets that mean "the user itself" */
const SELF_TARGETS = new Set(["user", "users-field", "user-and-allies", "user-or-ally", "all-allies"]);

async function fetchJson<T>(url: string, notFoundMessage = "Pokémon not found"): Promise<T> {
  const res = await fetch(url);
  if (res.status === 404) throw new HttpError(404, notFoundMessage);
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
  // Egg moves are listed on the Pokémon that hatches; an evolved Pokémon keeps the ones it learned back then
  let inheritedEggMoves: string[] = [];
  if (species.evolution_chain) {
    const chain = await fetchJson<RawEvolutionChain>(species.evolution_chain.url);
    evolution = toStages(chain.chain);
    const earlier = ancestorsOf(chain.chain, species.name) ?? [];
    const ancestors = await Promise.all(
      earlier.map((link) => fetchJson<RawPokemon>(`${BASE_URL}/pokemon/${idFromUrl(link.species.url)}`))
    );
    inheritedEggMoves = ancestors.flatMap((ancestor) =>
      ancestor.moves
        .filter((m) => m.version_group_details.some((d) => d.move_learn_method.name === "egg"))
        .map((m) => m.move.name)
    );
  }

  const flavor = species.flavor_text_entries.find((e) => e.language.name === "en");

  return {
    id: pokemon.id,
    name: pokemon.name,
    types: pokemon.types.map((t) => t.type.name as PokemonType),
    heightMeters: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    genderRate: species.gender_rate,
    description: flavor ? flavor.flavor_text.replace(/[\f\n]/g, " ") : null,
    artworkUrl: artworkUrl(pokemon.id),
    stats: pokemon.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    abilities: pokemon.abilities.map((a) => ({
      name: a.ability.name.replaceAll("-", " "),
      hidden: a.is_hidden,
    })),
    evolution,
    ...learnset(pokemon.moves, inheritedEggMoves),
  };
}

/** Moves learned by leveling up, from a TM, by breeding or from a move tutor in some game */
function learnset(moves: RawPokemon["moves"], inheritedEggMoves: string[]): Pick<PokemonDetail, "moves" | "learnMethods"> {
  const methodsByMove = new Map<string, Set<string>>();
  for (const { move, version_group_details } of moves) {
    methodsByMove.set(move.name, new Set(version_group_details.map((d) => d.move_learn_method.name)));
  }
  for (const move of inheritedEggMoves) {
    const methods = methodsByMove.get(move) ?? new Set<string>();
    methods.add("egg");
    methodsByMove.set(move, methods);
  }
  const learnMethods: Record<string, LearnMethod[]> = {};
  for (const [move, methods] of methodsByMove) {
    const learned = LEARN_METHODS.filter((method) => methods.has(method));
    if (learned.length > 0) learnMethods[move] = learned;
  }
  return { moves: Object.keys(learnMethods).sort(), learnMethods };
}

/** The earlier stages of a species in its evolution chain, from the first one, or null when it isn't in the chain */
function ancestorsOf(link: RawChainLink, name: string): RawChainLink[] | null {
  if (link.species.name === name) return [];
  for (const next of link.evolves_to) {
    const path = ancestorsOf(next, name);
    if (path) return [link, ...path];
  }
  return null;
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

/** PokéAPI's ailments that aren't a major status condition, like confusion or trapping */
function volatileOf(ailment: string | undefined): string | null {
  if (!ailment || ailment === "none" || ailment === "unknown" || isStatusCondition(ailment)) return null;
  return ailment;
}

/** Every move name, for picking Metronome's moves */
let moveNames: string[] | null = null;
export async function fetchMoveNames(): Promise<string[]> {
  moveNames ??= (await fetchJson<RawList>(`${BASE_URL}/move?limit=2000`)).results.map((move) => move.name);
  return moveNames;
}

export async function fetchMove(name: string): Promise<MoveInfo> {
  const move = await fetchJson<RawMove>(`${BASE_URL}/move/${name}`, `Move not found: ${name}`);
  return {
    name: move.name,
    type: move.type.name as PokemonType,
    category: move.damage_class.name as MoveCategory,
    power: move.power,
    accuracy: move.accuracy,
    ailment: isStatusCondition(move.meta?.ailment.name) ? move.meta.ailment.name : null,
    ailmentChance: move.meta?.ailment_chance ?? 0,
    critRate: move.meta?.crit_rate ?? 0,
    statChanges: move.stat_changes.flatMap((c): StatChange[] =>
      isBoostStat(c.stat.name) ? [{ stat: c.stat.name, change: c.change }] : []
    ),
    statTarget:
      move.meta?.category.name === "damage-raise" || SELF_TARGETS.has(move.target.name) ? "user" : "target",
    statChance: move.meta?.stat_chance ?? 0,
    healing: move.meta?.healing ?? 0,
    drain: move.meta?.drain ?? 0,
    priority: move.priority ?? 0,
    pp: move.pp,
    volatile: volatileOf(move.meta?.ailment.name),
    flinchChance: move.meta?.flinch_chance ?? 0,
    minHits: move.meta?.min_hits ?? null,
    maxHits: move.meta?.max_hits ?? null,
    target: move.target.name,
  };
}