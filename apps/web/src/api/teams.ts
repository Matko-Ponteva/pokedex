import type { Team, TeamInput } from "@pokedex/shared";
import { apiRequest } from "./client";

export function fetchTeams() {
  return apiRequest<Team[]>("/teams");
}

export function fetchTeam(id: number) {
  return apiRequest<Team>(`/teams/${id}`);
}

export function createTeam(input: TeamInput) {
  return apiRequest<Team>("/teams", { method: "POST", body: input });
}

export function updateTeam(id: number, input: TeamInput) {
  return apiRequest<Team>(`/teams/${id}`, { method: "PUT", body: input });
}

export function deleteTeam(id: number) {
  return apiRequest<void>(`/teams/${id}`, { method: "DELETE" });
}