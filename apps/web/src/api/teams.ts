import type { Team } from "@pokedex/shared";
import { apiRequest } from "./client";

export function fetchTeams() {
  return apiRequest<Team[]>("/teams");
}