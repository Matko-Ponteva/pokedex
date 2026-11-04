import { inArray } from "drizzle-orm";
import type { MoveInfo } from "@pokedex/shared";
import { db } from "../db/client.ts";
import { moves } from "../db/schema.ts";
import { fetchMove } from "../lib/pokeapi.ts";

/** Rows saved with an older version are missing data (accuracy, status and stat effects) and get refetched */
const MOVE_DATA_VERSION = 2;

function toMoveInfo(row: typeof moves.$inferSelect): MoveInfo {
  const { dataVersion: _version, ...info } = row;
  return info;
}

export async function getMoves(names: string[]): Promise<MoveInfo[]> {
  const unique = [...new Set(names)];
  const rows = await db.select().from(moves).where(inArray(moves.name, unique));
  const stored = rows.filter((row) => row.dataVersion >= MOVE_DATA_VERSION).map(toMoveInfo);

  const storedNames = new Set(stored.map((move) => move.name));
  const missing = unique.filter((name) => !storedNames.has(name));
  if (missing.length === 0) return stored;

  const fetched = await Promise.all(missing.map((name) => fetchMove(name)));
  for (const move of fetched) {
    const values = {
      ...move,
      accuracy: move.accuracy ?? null,
      ailment: move.ailment ?? null,
      ailmentChance: move.ailmentChance ?? 0,
      critRate: move.critRate ?? 0,
      statChanges: move.statChanges ?? [],
      statTarget: move.statTarget ?? "target",
      statChance: move.statChance ?? 0,
      healing: move.healing ?? 0,
      drain: move.drain ?? 0,
      dataVersion: MOVE_DATA_VERSION,
    };
    await db.insert(moves).values(values).onConflictDoUpdate({ target: moves.name, set: values });
  }
  return [...stored, ...fetched];
}
