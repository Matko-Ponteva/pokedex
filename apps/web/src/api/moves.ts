import type { MoveInfo } from "@pokedex/shared";
import { apiRequest } from "./client";

export function fetchMoves(names: string[]) {
  const params = new URLSearchParams({ names: names.join(",") });
  return apiRequest<MoveInfo[]>(`/moves?${params}`);
}