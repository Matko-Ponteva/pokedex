import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Team, TeamInput } from "@pokedex/shared";
import { createTeam, deleteTeam, fetchTeam, fetchTeams, updateTeam } from "../api/teams";

const teamsKey = ["teams"] as const;
const teamKey = (id: number) => ["teams", id] as const;

export function useTeams() {
  return useQuery({ queryKey: teamsKey, queryFn: fetchTeams });
}

export function useTeam(id: number | null) {
  return useQuery({
    queryKey: teamKey(id ?? 0),
    queryFn: () => fetchTeam(id!),
    enabled: id !== null,
  });
}

export function useSaveTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: TeamInput }) =>
      id === null ? createTeam(input) : updateTeam(id, input),
    onSuccess: (team) => {
      queryClient.setQueryData(teamKey(team.id), team);
      queryClient.setQueryData<Team[]>(teamsKey, (teams) => {
        if (!teams) return teams;
        return teams.some((t) => t.id === team.id)
          ? teams.map((t) => (t.id === team.id ? team : t))
          : [...teams, team];
      });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTeam,
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: teamsKey, exact: true });
      const previous = queryClient.getQueryData<Team[]>(teamsKey);
      queryClient.setQueryData<Team[]>(teamsKey, (teams) => teams?.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(teamsKey, context.previous);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: teamKey(id), exact: true });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamsKey, exact: true });
    },
  });
}