import type { Team, TeamInput, PublicTeam, PublicTeamListResponse, PublicTeamSort } from "@pokedex/shared";
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

export function fetchPublicTeam(shareId: string) {
  return apiRequest<PublicTeam>(`/public/teams/${shareId}`);
}

type PublicTeamParams = {
  search: string;
  sort: PublicTeamSort;
  cursor: string | null;
};

export function fetchPublicTeams({ search, sort, cursor }: PublicTeamParams) {
  const params = new URLSearchParams({ sort });
  if (search) params.set("search", search);
  if (cursor) params.set("cursor", cursor);
  return apiRequest<PublicTeamListResponse>(`/public/teams?${params}`);
}