import { and, arrayContains, asc, count, eq, ilike, type SQL } from "drizzle-orm";
import { db } from "../db/client.ts";
import { pokemon, pokemonDetails } from "../db/schema.ts";
import { fetchPokemonDetail, fetchPokemonIndex, type PokemonDetail } from "../lib/pokeapi.ts";
import type { PokemonType } from "../lib/pokemonTypes.ts";

async function ensureIndex() {
  const [{ total }] = await db.select({ total: count() }).from(pokemon);
  if (total > 0) return;

  const index = await fetchPokemonIndex();
  await db.insert(pokemon).values(index).onConflictDoNothing();
}

type ListOptions = {
  search?: string;
  type?: PokemonType;
  page: number;
  pageSize: number;
};

export async function listPokemon({ search, type, page, pageSize }: ListOptions) {
  await ensureIndex();

  const filters: SQL[] = [];
  if (search) filters.push(ilike(pokemon.name, `%${search}%`));
  if (type) filters.push(arrayContains(pokemon.types, [type]));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db.select().from(pokemon)
      .where(where)
      .orderBy(asc(pokemon.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(pokemon).where(where),
  ]);

  return { items, page, pageSize, total, hasMore: page * pageSize < total };
}

export async function getPokemon(id: number): Promise<PokemonDetail> {
  const [row] = await db.select().from(pokemonDetails).where(eq(pokemonDetails.id, id));
  if (row) return row.data;

  const detail = await fetchPokemonDetail(id);
  await db.insert(pokemonDetails).values({ id, data: detail }).onConflictDoNothing();
  return detail;
}