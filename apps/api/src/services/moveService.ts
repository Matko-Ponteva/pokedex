import { inArray } from "drizzle-orm";
import { NO_CALL_MOVES, isUsableMove, type MoveInfo } from "@pokedex/shared";
import { db } from "../db/client.ts";
import { moves } from "../db/schema.ts";
import { fetchMove, fetchMoveNames } from "../lib/pokeapi.ts";

/** Rows saved with an older version are missing data (accuracy, effects, priority, PP, hit counts) and get refetched */
const MOVE_DATA_VERSION = 5;

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
      priority: move.priority ?? 0,
      pp: move.pp ?? null,
      volatile: move.volatile ?? null,
      flinchChance: move.flinchChance ?? 0,
      minHits: move.minHits ?? null,
      maxHits: move.maxHits ?? null,
      dataVersion: MOVE_DATA_VERSION,
    };
    await db.insert(moves).values(values).onConflictDoUpdate({ target: moves.name, set: values });
  }
  return [...stored, ...fetched];
}

/** Moves that only exist in special forms (Z-Moves, Max Moves, Shadow moves) and can't be called by Metronome */
function isRegularMove(name: string): boolean {
  return !name.includes("--") && !name.startsWith("max-") && !name.startsWith("g-max-") && !name.startsWith("shadow-");
}

const METRONOME_POOL_SIZE = 30;

/** A random selection of moves for Metronome to pick from during a battle */
export async function getMetronomePool(): Promise<MoveInfo[]> {
  const names = (await fetchMoveNames()).filter((name) => isRegularMove(name) && !NO_CALL_MOVES.has(name));
  const picked = new Set<string>();
  while (picked.size < Math.min(METRONOME_POOL_SIZE, names.length)) picked.add(names[Math.floor(Math.random() * names.length)]);
  const moves = await getMoves([...picked]);
  return moves.filter(isUsableMove);
}
