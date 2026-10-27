import { inArray } from "drizzle-orm";
import type { MoveInfo } from "@pokedex/shared";
import { db } from "../db/client.ts";
import { moves } from "../db/schema.ts";
import { fetchMove } from "../lib/pokeapi.ts";

export async function getMoves(names: string[]): Promise<MoveInfo[]> {
  const unique = [...new Set(names)];
  const stored = await db.select().from(moves).where(inArray(moves.name, unique));

  const storedNames = new Set(stored.map((move) => move.name));
  const missing = unique.filter((name) => !storedNames.has(name));
  if (missing.length === 0) return stored;

  const fetched = await Promise.all(missing.map((name) => fetchMove(name)));
  await db.insert(moves).values(fetched).onConflictDoNothing();
  return [...stored, ...fetched];
}